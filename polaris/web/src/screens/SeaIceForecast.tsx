import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  getSeaIceCurrent,
  getSeaIceForecast,
  getSeaIceExtent,
  type SeaIceCurrentResponse,
  type SeaIceForecastResponse,
} from "../lib/api";
import { num, pct } from "../lib/format";
import { Busy, Failure, Panel, Pill, StatTile } from "../components/primitives";
import { Icon } from "../components/Icon";
import { PolarisMap } from "../components/map/PolarisMap";
import { SeaIceLayer } from "../components/map/SeaIceLayer";
import { MapLegend } from "../components/MapLegend";
import { HorizonSelector } from "../components/HorizonSelector";

export function SeaIceForecast() {
  const [horizon, setHorizon] = useState<number>(48);
  const [showHeatmap, setShowHeatmap] = useState<boolean>(true);
  const [showStations, setShowStations] = useState<boolean>(true);

  // Load current observations if horizon === 0
  const currentQ = useQuery({
    queryKey: ["sea-ice", "current"],
    queryFn: () => getSeaIceCurrent({ stride: 2 }),
    enabled: horizon === 0,
    staleTime: 60_000,
  });

  // Load forecast if horizon > 0
  const forecastQ = useQuery({
    queryKey: ["sea-ice", "forecast", horizon],
    queryFn: () => getSeaIceForecast({ horizon }),
    enabled: horizon > 0,
    staleTime: 60_000,
  });

  // Load hemispheric extent time series
  const extentQ = useQuery({
    queryKey: ["sea-ice", "extent"],
    queryFn: () => getSeaIceExtent({ months: 24 }),
    staleTime: 5 * 60_000,
  });

  const isLoading = horizon === 0 ? currentQ.isLoading : forecastQ.isLoading;
  const isError = horizon === 0 ? currentQ.isError : forecastQ.isError;
  const data: SeaIceCurrentResponse | SeaIceForecastResponse | undefined =
    horizon === 0 ? currentQ.data : forecastQ.data;

  if (isError) {
    return (
      <Failure
        message="SEA ICE FORECAST FEED UNAVAILABLE"
        hint="Failed to retrieve sea ice concentration and forecast model data from the backend."
      />
    );
  }

  const forecastData = horizon > 0 ? (data as SeaIceForecastResponse) : null;
  const stats = data?.statistics;
  const metrics = forecastData?.validationMetrics;

  return (
    <div className="flex flex-col gap-gutter-md">
      {/* Top Command Telemetry Bar */}
      <div className="glass-panel flex flex-wrap items-center justify-between gap-gutter-md px-panel-pad-default py-panel-pad-compact">
        <div className="flex flex-wrap items-center gap-gutter-lg">
          <HorizonSelector
            value={horizon}
            onChange={setHorizon}
            options={[0, 24, 48, 72]}
            label="FORECAST HORIZON:"
          />

          <div className="flex items-center gap-1.5 px-2 py-1 bg-surface-raised border border-border-subtle rounded">
            <Icon name="model_training" className="text-primary text-[15px]" />
            <span className="font-telemetry-code text-telemetry-code text-text-muted">MODEL:</span>
            <span className="font-telemetry-code text-telemetry-code font-bold text-text-primary">
              {forecastData?.modelName || "OBSERVED AMSR2 / SENTINEL-1"}
            </span>
          </div>

          <div className="flex items-center gap-1.5 px-2 py-1 bg-surface-raised border border-border-subtle rounded">
            <span className="w-1.5 h-1.5 rounded-full bg-status-safe animate-pulse" />
            <span className="font-telemetry-code text-telemetry-code text-text-muted">VALID:</span>
            <span className="font-telemetry-code text-telemetry-code font-bold text-primary">
              {forecastData ? `${forecastData.forecastHours}H (T+${forecastData.forecastHours})` : "NOW (T+0)"}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-gutter-sm">
          <Pill level="telemetry">EPSG:3031 POLAR</Pill>
          <Pill level={data?.provenance.dataMode === "real" ? "safe" : "caution"}>
            {data?.provenance.dataMode?.toUpperCase() ?? "DEMO"}
          </Pill>
        </div>
      </div>

      {/* KPI Stats Strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-6 gap-gutter-sm">
        <StatTile
          label="MEAN CONCENTRATION"
          value={pct(stats?.meanConcentration)}
          status="telemetry"
        />
        <StatTile
          label="MAX CONCENTRATION"
          value={pct(stats?.maxConcentration)}
          status={stats && stats.maxConcentration > 0.85 ? "danger" : undefined}
        />
        <StatTile
          label="ICE COVERED FRACTION"
          value={pct(stats?.iceCoveredFraction)}
        />
        <StatTile
          label="HEMISPHERIC EXTENT"
          value={num(
            data && "hemisphericExtentMillionKm2" in data
              ? data.hemisphericExtentMillionKm2
              : extentQ.data?.series?.[extentQ.data.series.length - 1]?.extentMillionKm2,
            2,
          )}
          unit="M KM²"
          status="safe"
        />
        <StatTile
          label="RMSE VS OBSERVED"
          value={metrics ? `${(metrics.rmse * 100).toFixed(1)}%` : "—"}
        />
        <StatTile
          label="SKILL VS PERSISTENCE"
          value={metrics ? `+${(metrics.skillVsPersistence * 100).toFixed(1)}%` : "100%"}
          status="safe"
        />
      </div>

      {/* Main Split Matrix: Map Viewport (8 col) + Analytical Sidebar (4 col) */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-gutter-md">
        {/* Central Map Viewport */}
        <div className="xl:col-span-8 flex flex-col min-w-0">
          <Panel
            label="POLAR SEA ICE CONCENTRATION FIELD"
            icon="layers"
            right={
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-1 text-[11px] font-mono text-text-secondary cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showHeatmap}
                    onChange={(e) => setShowHeatmap(e.target.checked)}
                    className="accent-primary"
                  />
                  <span>CONCENTRATION</span>
                </label>
                <label className="flex items-center gap-1 text-[11px] font-mono text-text-secondary cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showStations}
                    onChange={(e) => setShowStations(e.target.checked)}
                    className="accent-primary"
                  />
                  <span>STATIONS</span>
                </label>
              </div>
            }
            className="h-[620px] flex flex-col"
            contentClassName="flex-1 relative bg-surface-void overflow-hidden"
          >
            {isLoading && (
              <div className="absolute inset-0 z-[1000] bg-surface-void/70 flex items-center justify-center">
                <Busy label="COMPUTING POLAR ENSEMBLE FIELD..." />
              </div>
            )}

            <PolarisMap
              center={[-65, 50]}
              zoom={3}
              showStations={showStations}
              className="w-full h-full min-h-[500px]"
            >
              {showHeatmap && data?.field && <SeaIceLayer field={data.field} />}
            </PolarisMap>

            {/* Ice Concentration Legend Overlay */}
            <div className="absolute bottom-3 left-12 z-[1000] pointer-events-auto">
              <MapLegend type="ice" />
            </div>
          </Panel>
        </div>

        {/* Right Analytical Stack */}
        <div className="xl:col-span-4 flex flex-col gap-gutter-md min-w-0">
          {/* Panel 1: Model & Validation Edge Metrics */}
          <Panel label="FORECAST VALIDATION METRICS" icon="psychology">
            {metrics ? (
              <div className="flex flex-col gap-gutter-sm">
                <div className="flex items-center justify-between pb-1 border-b border-border-subtle">
                  <span className="micro-label text-text-muted">BENCHMARK</span>
                  <span className="font-telemetry-code text-telemetry-code font-bold text-primary">
                    {metrics.selectedCandidate.toUpperCase()}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-gutter-sm">
                  <div className="bg-surface-container-lowest p-2 rounded border border-border-subtle">
                    <div className="micro-label text-text-muted">RMSE ERROR</div>
                    <div className="font-stat-metric text-[20px] font-bold text-status-safe">
                      {(metrics.rmse * 100).toFixed(2)}%
                    </div>
                  </div>
                  <div className="bg-surface-container-lowest p-2 rounded border border-border-subtle">
                    <div className="micro-label text-text-muted">EDGE ACCURACY</div>
                    <div className="font-stat-metric text-[20px] font-bold text-primary">
                      {pct(metrics.edge.accuracy)}
                    </div>
                  </div>
                </div>

                <div className="flex flex-col gap-1.5 pt-1">
                  <div className="flex justify-between text-[11px] font-mono">
                    <span className="text-text-muted">Edge Precision / Recall:</span>
                    <span className="text-text-primary font-bold">
                      {pct(metrics.edge.precision)} / {pct(metrics.edge.recall)}
                    </span>
                  </div>
                  <div className="flex justify-between text-[11px] font-mono">
                    <span className="text-text-muted">Edge F1-Score:</span>
                    <span className="text-text-primary font-bold">{metrics.edge.f1.toFixed(3)}</span>
                  </div>
                  <div className="flex justify-between text-[11px] font-mono">
                    <span className="text-text-muted">Persistence RMSE:</span>
                    <span className="text-text-muted">
                      {(metrics.persistenceBaseline.rmse * 100).toFixed(2)}%
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="py-4 text-center text-text-muted font-mono text-body-sm">
                Observed baseline (T+0). Switch horizon to +24h, +48h, or +72h to inspect AI model validation metrics.
              </div>
            )}
          </Panel>

          {/* Panel 2: Regional Sea Ice Summary */}
          <Panel label="REGIONAL PACK ICE STATUS" icon="grid_view">
            <div className="flex flex-col gap-3">
              {[
                { name: "Prydz Bay Sector", conc: 0.81, trend: "+14% (24h)", warn: true },
                { name: "Weddell Sea Margin", conc: 0.76, trend: "Stable", warn: false },
                { name: "Ross Sea Approaches", conc: 0.62, trend: "-5% (24h)", warn: false },
                { name: "Cosmonaut Sea Leads", conc: 0.28, trend: "Open leads", safe: true },
              ].map((region) => (
                <div key={region.name} className="flex flex-col gap-1">
                  <div className="flex items-center justify-between text-[12px] font-mono">
                    <span className="text-text-primary font-semibold">{region.name}</span>
                    <span
                      className={`font-bold ${
                        region.warn
                          ? "text-status-danger"
                          : region.safe
                          ? "text-status-safe"
                          : "text-text-primary"
                      }`}
                    >
                      {(region.conc * 100).toFixed(0)}%
                    </span>
                  </div>
                  <div className="w-full h-1.5 bg-surface-container-lowest border border-border-subtle rounded-full overflow-hidden">
                    <div
                      className={`h-full ${
                        region.warn
                          ? "bg-status-danger"
                          : region.safe
                          ? "bg-status-safe"
                          : "bg-primary"
                      }`}
                      style={{ width: `${region.conc * 100}%` }}
                    />
                  </div>
                  <span className="text-[10px] font-mono text-text-muted">{region.trend}</span>
                </div>
              ))}
            </div>
          </Panel>

          {/* Panel 3: Extent History */}
          <Panel label="HEMISPHERIC EXTENT TREND" icon="show_chart">
            <div className="flex flex-col gap-2">
              <div className="text-[11px] font-mono text-text-muted">
                Antarctic seasonal sea ice extent index (24-month monitoring):
              </div>
              <div className="h-20 w-full flex items-end gap-1 px-1 py-2 bg-surface-container-lowest rounded border border-border-subtle">
                {extentQ.data?.series?.slice(-18).map((pt, idx) => {
                  const heightPct = Math.min(100, Math.max(15, (pt.extentMillionKm2 / 20) * 100));
                  return (
                    <div
                      key={idx}
                      className="flex-1 bg-primary/40 hover:bg-primary transition-all rounded-t-xs relative group cursor-pointer"
                      style={{ height: `${heightPct}%` }}
                    >
                      <div className="hidden group-hover:block absolute bottom-full left-1/2 -translate-x-1/2 mb-1 px-1.5 py-0.5 bg-surface-raised border border-border-subtle text-[9px] font-mono text-text-primary whitespace-nowrap z-30 shadow">
                        {num(pt.extentMillionKm2, 2)} M km²
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="flex justify-between text-[10px] font-mono text-text-muted">
                <span>HISTORIC MIN</span>
                <span className="text-primary font-bold">CURRENT PEAK</span>
              </div>
            </div>
          </Panel>
        </div>
      </div>
    </div>
  );
}
