/**
 * Ops Console (dashboard) — Stitch screen 00.
 *
 * Structure from the design:
 *   - Top Tactical Meta Row (mission / sat feed / encryption / drift / accuracy)
 *   - 12-col grid: 8-col tactical map viewport (Leaflet risk heatmap — Phase 1)
 *     + 4-col right analytics stack
 *   - Below: ROUTE EVALUATION MATRIX, PASSAGE RISK OVERVIEW, MISSION CRITICAL
 *     ALERTS, AI TRAJECTORY RECOMMENDATION, SEA ICE FORECAST, ICEBERG
 *     TRAJECTORY, OCEAN & WEATHER TELEMETRY
 *
 * Phase 0: layout + live data wiring (dashboard/summary + risk/map). The map
 * panel is a placeholder viewport until Phase 1 lands Leaflet.
 */

import { useQuery } from "@tanstack/react-query";
import { getDashboardSummary, getRiskMap } from "../lib/api";
import { num, pct, coord } from "../lib/format";
import { riskBand } from "../lib/types";
import type { DashboardSummary, RiskHotspot } from "../lib/types";
import { Busy, Failure, Panel, Pill, RiskMeter, StatTile } from "../components/primitives";
import { Icon } from "../components/Icon";

// ---------- top tactical meta row ----------

function MetaChip({ icon, label, value, warn }: { icon: Parameters<typeof Icon>[0]["name"]; label: string; value: string; warn?: boolean }) {
  return (
    <div className="flex items-center gap-gutter-xs min-w-0">
      <Icon name={icon} className={`${warn ? "text-status-danger" : "text-text-muted"} text-[14px] shrink-0`} />
      <span className="micro-label text-text-muted shrink-0">{label}</span>
      <span
        className={`font-telemetry-code text-telemetry-code truncate ${warn ? "text-status-danger font-bold" : "text-text-primary font-bold"}`}
      >
        {value}
      </span>
    </div>
  );
}

function TacticalMetaRow({ summary }: { summary: DashboardSummary }) {
  const v = summary?.routing?.stations?.["cape_town"];
  return (
    <div className="glass-panel flex flex-wrap items-center gap-gutter-lg px-panel-pad-default py-panel-pad-dense">
      <MetaChip icon="flag" label="MISSION:" value="EXPEDITION PR-44-ANTARCTICA" />
      <MetaChip icon="satellite_alt" label="SAT FEED:" value="SENTINEL-1A" />
      <MetaChip icon="security" label="ENCRYPTION:" value="QUANTUM KEY M-7" />
      <MetaChip icon="explore" label="LATERAL DRIFT:" value="0.05 NM" />
      <MetaChip icon="grid_view" label="GRID ACCURACY:" value="99.84%" />
      <MetaChip
        icon="warning"
        label="A17 INTERCEPT:"
        value={summary.icebergs?.largest ? `WARN — ${coord(summary.icebergs.largest.latitude, summary.icebergs.largest.longitude)}` : "NOMINAL"}
        warn={Boolean(summary.icebergs?.largest)}
      />
      {v && <MetaChip icon="anchor" label="CAPE TOWN GATEWAY:" value={v.inDomain ? "IN DOMAIN" : "OUT OF DOMAIN"} />}
    </div>
  );
}

import { PolarisMap } from "../components/map/PolarisMap";
import { RiskHeatmapLayer } from "../components/map/RiskHeatmapLayer";
import { MapLegend } from "../components/MapLegend";

function TacticalSituationMap({
  summary,
  riskData,
}: {
  summary: DashboardSummary;
  riskData?: import("../lib/types").RiskMapResponse;
}) {
  return (
    <Panel
      label="TACTICAL SITUATION MAP"
      icon="public"
      right={
        <div className="flex items-center gap-2">
          <Pill level={summary.dataMode === "real" ? "safe" : "telemetry"}>
            {summary.dataMode === "real" ? "LIVE SAT FEED" : "SYNTHETIC SEED"}
          </Pill>
          <span className="font-telemetry-code text-telemetry-code text-text-muted hidden sm:inline">
            {num(riskData?.summary?.cellsNavigable ?? summary.risk?.cellsNavigable ?? 0, 0)} NAVIGABLE CELLS
          </span>
        </div>
      }
      className="h-[580px] flex flex-col"
      contentClassName="flex-1 relative bg-surface-void overflow-hidden"
    >
      <PolarisMap center={[-65, 50]} zoom={3} className="w-full h-full min-h-[500px]">
        {riskData && <RiskHeatmapLayer data={riskData} />}
      </PolarisMap>

      {/* Floating Legend */}
      <div className="absolute bottom-3 left-12 z-[1000] pointer-events-auto">
        <MapLegend type="risk" />
      </div>
    </Panel>
  );
}

// ---------- right analytics column ----------

function RiskOverview({ summary }: { summary: DashboardSummary }) {
  const r = summary.risk;
  const weights = r?.weights;
  const weightRows: Array<[keyof typeof weights, string]> = [
    ["seaIce", "SEA ICE"],
    ["iceberg", "ICEBERG"],
    ["weather", "WEATHER"],
    ["ocean", "OCEAN"],
    ["constraint", "CONSTRAINT"],
  ];
  return (
    <Panel label="PASSAGE RISK OVERVIEW" icon="warning">
      <div className="flex items-center justify-between gap-gutter-sm pb-panel-pad-compact">
        <div>
          <div className="micro-label text-text-muted">MEAN FIELD RISK</div>
          <div className="flex items-center gap-gutter-sm">
            <span className="font-stat-metric text-stat-metric text-text-primary">{(r?.meanRisk ?? 0).toFixed(3)}</span>
            <RiskMeter risk={r?.meanRisk ?? 0} />
          </div>
        </div>
        <div className="text-right">
          <div className="micro-label text-text-muted">PEAK CELL</div>
          <span className="font-stat-metric text-stat-metric text-status-danger">{(r?.maxRisk ?? 0).toFixed(3)}</span>
        </div>
      </div>

      <div className="border-t border-border-subtle pt-panel-pad-compact">
        <div className="micro-label text-text-muted pb-2">COMPONENT WEIGHTS</div>
        <div className="flex flex-col gap-1.5">
          {weightRows.map(([key, label]) => {
            const w = weights?.[key];
            return (
              <div key={key} className="flex items-center gap-gutter-sm">
                <span className="font-telemetry-code text-telemetry-code text-text-secondary w-24 shrink-0">{label}</span>
                <div className="flex-1 h-1.5 bg-surface-container-high">
                  <div className="h-full bg-primary-container" style={{ width: `${(w ?? 0) * 100}%` }} />
                </div>
                <span className="font-telemetry-code text-telemetry-code text-text-primary font-bold w-12 text-right">
                  {w != null ? (w * 100).toFixed(0) : "—"}%
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {r?.highestRiskAreas?.length ? (
        <div className="border-t border-border-subtle pt-panel-pad-compact">
          <div className="micro-label text-text-muted pb-2">HIGHEST RISK AREAS</div>
          <div className="flex flex-col gap-1.5">
            {r.highestRiskAreas.slice(0, 4).map((h: RiskHotspot, i: number) => (
              <div key={i} className="flex items-center gap-gutter-sm">
                <span className="font-telemetry-code text-telemetry-code text-status-danger w-12 shrink-0">{h.totalRisk.toFixed(2)}</span>
                <span className="font-telemetry-code text-telemetry-code text-text-secondary">{coord(h.latitude, h.longitude)}</span>
                <span className="font-telemetry-code text-telemetry-code text-text-muted ml-auto truncate max-w-[9rem]">
                  {h.dominantComponent.replace(/_/g, " ")}
                </span>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </Panel>
  );
}

function ForecastCards({ summary }: { summary: DashboardSummary }) {
  const horizons = summary.forecast?.horizons ?? {};
  const entries = Object.entries(horizons).sort(([a], [b]) => Number(a) - Number(b));
  return (
    <Panel label="SEA ICE FORECAST" icon="layers" right={<Pill level="telemetry">AICE-v2 ENSEMBLE</Pill>}>
      {entries.length === 0 ? (
        <Busy label="AWAITING FORECAST" />
      ) : (
        <div className="grid grid-cols-1 gap-gutter-sm">
          {entries.map(([hours, f]) => {
            const band = riskBand(f.meanConcentration);
            const level = band === "blocked" || band === "high" ? "danger" : band === "moderate" ? "caution" : "safe";
            return (
              <div key={hours} className="bg-surface-container-lowest border border-border-subtle px-panel-pad-compact py-panel-pad-dense">
                <div className="flex items-center justify-between gap-gutter-sm">
                  <span className="micro-label text-text-muted">+{hours}H</span>
                  <Pill level={level as "danger" | "caution" | "safe"}>{f.status.toUpperCase()}</Pill>
                </div>
                <div className="grid grid-cols-2 gap-gutter-sm pt-gutter-sm">
                  <div>
                    <div className="micro-label text-text-muted">MEAN CONC</div>
                    <span className="font-telemetry-code text-telemetry-code text-text-primary font-bold">
                      {pct(f.meanConcentration)}
                    </span>
                  </div>
                  <div>
                    <div className="micro-label text-text-muted">ICE COVERED</div>
                    <span className="font-telemetry-code text-telemetry-code text-text-primary font-bold">
                      {pct(f.iceCoveredFraction)}
                    </span>
                  </div>
                  <div>
                    <div className="micro-label text-text-muted">SKILL</div>
                    <span className="font-telemetry-code text-telemetry-code text-status-telemetry font-bold">
                      {pct(f.skillVsPersistence)}
                    </span>
                  </div>
                  <div>
                    <div className="micro-label text-text-muted">RMSE</div>
                    <span className="font-telemetry-code text-telemetry-code text-text-secondary">{f.validationRmse.toFixed(3)}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Panel>
  );
}

function IcebergWatch({ summary }: { summary: DashboardSummary }) {
  const b = summary.icebergs;
  const largest = b?.largest;
  return (
    <Panel
      label="ICEBERG TRAJECTORY"
      icon="radar"
      right={
        b?.trackedCount ? (
          <Pill level="danger">{b.trackedCount} TRACKED</Pill>
        ) : (
          <Pill level="neutral">NO TARGETS</Pill>
        )
      }
    >
      {largest ? (
        <div className="flex flex-col gap-gutter-sm">
          <div className="flex items-center justify-between gap-gutter-sm">
            <span className="font-headline-sm text-headline-sm text-text-primary">{largest.icebergId}</span>
            <span className="font-telemetry-code text-telemetry-code text-text-secondary">
              {num(largest.areaKm2)} km²
            </span>
          </div>
          <div className="grid grid-cols-2 gap-gutter-sm">
            <StatTile label="LAST POSITION" value={coord(largest.latitude, largest.longitude)} />
            <StatTile label="WITH DRIFT MODEL" value={String(b.withDerivedDrift ?? 0)} unit={`OF ${b.trackedCount ?? 0}`} />
          </div>
          <p className="font-body-sm text-body-sm text-text-muted">
            A17-class intercept monitoring active. Full drift tracks render on the Iceberg Tracker screen.
          </p>
        </div>
      ) : (
        <p className="font-body-sm text-body-sm text-text-muted py-2">No tracked icebergs in the operational domain.</p>
      )}
    </Panel>
  );
}

function IngestionFeed({ summary }: { summary: DashboardSummary }) {
  const recent = summary.ingestion?.recent ?? [];
  return (
    <Panel
      label="LIVE INGESTION FEED"
      icon="sync"
      right={<span className="font-telemetry-code text-telemetry-code text-status-safe">{recent.length} SOURCES</span>}
    >
      {recent.length === 0 ? (
        <p className="font-body-sm text-body-sm text-text-muted py-2">No recent ingestion records.</p>
      ) : (
        <ul className="flex flex-col gap-1">
          {recent.slice(0, 5).map((rec, i) => (
            <li key={i} className="flex items-center gap-gutter-sm">
              <span className="inline-block w-1.5 h-1.5 shrink-0" style={{ background: rec.status === "ok" ? "var(--color-status-safe)" : "var(--color-status-caution)" }} />
              <span className="font-telemetry-code text-telemetry-code text-text-secondary truncate">{rec.source}</span>
              <span className="font-telemetry-code text-telemetry-code text-text-muted truncate">/{rec.dataset}</span>
              <span className="font-telemetry-code text-telemetry-code text-text-primary font-bold ml-auto shrink-0">
                {num(rec.records, 0)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

// ---------- screen ----------

export function OpsConsole() {
  const summaryQ = useQuery({
    queryKey: ["dashboard"],
    queryFn: getDashboardSummary,
  });

  const riskQ = useQuery({
    queryKey: ["risk", "map", { horizon: 0, stride: 4 }],
    refetchInterval: 5 * 60_000,
    queryFn: () => getRiskMap({ horizon: 0, stride: 4 }),
  });

  if (summaryQ.isError) {
    return (
      <Failure
        message="DASHBOARD SUMMARY UNAVAILABLE"
        hint="Backend API not reachable. Verify uvicorn is serving on :8000 and refresh."
      />
    );
  }

  const summary = summaryQ.data;
  const loading = summaryQ.isPending;

  return (
    <div className="flex flex-col gap-gutter-md">
      {loading || !summary ? <Busy label="SYNCING OPERATIONAL PICTURE" /> : <TacticalMetaRow summary={summary} />}

      {/* 12-col tactical grid */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-gutter-md">
        <div className="xl:col-span-8 min-w-0">
          {summary ? <TacticalSituationMap summary={summary} riskData={riskQ.data} /> : null}
        </div>
        <div className="xl:col-span-4 min-w-0 flex flex-col gap-gutter-md">
          {summary ? (
            <>
              <RiskOverview summary={summary} />
              <ForecastCards summary={summary} />
            </>
          ) : (
            <div className="h-[300px]"><Busy label="LOADING ANALYTICS" /></div>
          )}
        </div>
      </div>

      {/* stat tile strip */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-gutter-sm">
          <StatTile label="MEAN CONCENTRATION" value={pct(summary.seaIce?.meanConcentration)} status="telemetry" />
          <StatTile label="ICE-COVERED FRACTION" value={pct(summary.seaIce?.iceCoveredFraction)} />
          <StatTile label="HEMISPHERIC EXTENT" value={num(summary.seaIce?.hemisphericExtentMillionKm2, 2)} unit="M KM²" />
          <StatTile label="TRACKED ICEBERGS" value={num(summary.icebergs?.trackedCount, 0)} status="danger" />
          <StatTile
            label="FIELD RISK MEAN"
            value={(summary.risk?.meanRisk ?? 0).toFixed(3)}
            status={(summary.risk?.meanRisk ?? 0) >= 0.4 ? "caution" : "safe"}
          />
          <StatTile
            label="NAVIGABLE CELLS"
            value={num(summary.risk?.cellsNavigable, 0)}
            unit={`OF ${num((summary.risk?.cellsNavigable ?? 0) + (summary.risk?.cellsBlocked ?? 0), 0)}`}
            status="safe"
          />
        </div>
      )}

      {/* analytics row */}
      {summary && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-gutter-md">
          <IcebergWatch summary={summary} />
          <IngestionFeed summary={summary} />
          <Panel label="SYSTEM TELEMETRY" icon="monitoring">
            <div className="flex flex-col gap-1.5">
              {[
                ["DATA MODE", summary.dataMode?.toUpperCase() ?? "—", "telemetry"],
                ["ROUTE RESULTS STORED", num(summary.database?.rowCounts?.routeResults, 0), ""],
                ["RISK GRID SNAPSHOTS", num(summary.database?.rowCounts?.riskGrid, 0), ""],
                ["GRAPH EDGES", num(summary.routing?.graphEdges, 0), ""],
                ["ICEBERG TRAJECTORIES", num(summary.database?.rowCounts?.icebergTrajectories, 0), ""],
              ].map(([label, value, tone]) => (
                <div key={label} className="flex items-center justify-between gap-gutter-sm">
                  <span className="font-telemetry-code text-telemetry-code text-text-muted truncate">{label}</span>
                  <span
                    className={`font-telemetry-code text-telemetry-code font-bold ${tone === "telemetry" ? "text-status-telemetry" : "text-text-primary"}`}
                  >
                    {value}
                  </span>
                </div>
              ))}
              {riskQ.data && (
                <div className="flex items-center justify-between gap-gutter-sm border-t border-border-subtle pt-1.5 mt-1.5">
                  <span className="font-telemetry-code text-telemetry-code text-text-muted">RISK MAP CACHE</span>
                  <span className="font-telemetry-code text-telemetry-code text-status-safe font-bold">
                    {num(riskQ.data.summary?.cellsTotal, 0)} CELLS
                  </span>
                </div>
              )}
            </div>
          </Panel>
        </div>
      )}

      {summary?.disclaimer && (
        <p className="font-body-sm text-body-sm text-text-muted px-panel-pad-compact">
          {summary.disclaimer}
        </p>
      )}
    </div>
  );
}
