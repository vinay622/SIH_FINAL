import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  getRiskMap,
  getRiskPoint,
  type PointRiskResponse,
} from "../lib/api";
import { coord, num, pct } from "../lib/format";
import { Busy, Failure, Panel, Pill, StatTile } from "../components/primitives";
import { Icon } from "../components/Icon";
import { PolarisMap } from "../components/map/PolarisMap";
import { RiskHeatmapLayer } from "../components/map/RiskHeatmapLayer";
import { MapLegend } from "../components/MapLegend";
import { HorizonSelector } from "../components/HorizonSelector";
import { useVessel } from "../hooks/useVessel";

export function RiskAnalysis() {
  const { vessel, updateVessel } = useVessel();
  const [horizon, setHorizon] = useState<number>(48);
  const [selectedPoint, setSelectedPoint] = useState<{ lat: number; lon: number } | null>(null);

  // Load risk map
  const riskMapQ = useQuery({
    queryKey: ["risk", "map", { horizon, stride: 4 }],
    queryFn: () => getRiskMap({ horizon, stride: 4 }),
    staleTime: 5 * 60_000,
  });

  // Load point risk on click
  const pointQ = useQuery<PointRiskResponse>({
    queryKey: ["risk", "point", selectedPoint?.lat, selectedPoint?.lon, horizon],
    queryFn: () => getRiskPoint(selectedPoint!.lat, selectedPoint!.lon, { horizon }),
    enabled: Boolean(selectedPoint),
    staleTime: 60_000,
  });

  if (riskMapQ.isError) {
    return (
      <Failure
        message="RISK MODEL FIELD UNAVAILABLE"
        hint="Failed to retrieve multi-layer polar risk map grid from backend."
      />
    );
  }

  const summary = riskMapQ.data?.summary;
  const weights = summary?.weights;
  const hotspots = riskMapQ.data?.hotspots ?? [];
  const pointData = pointQ.data;

  return (
    <div className="flex flex-col gap-gutter-md">
      {/* Top Command Telemetry Control Strip */}
      <div className="glass-panel flex flex-wrap items-center justify-between gap-gutter-md px-panel-pad-default py-panel-pad-compact">
        <div className="flex flex-wrap items-center gap-gutter-lg">
          <HorizonSelector
            value={horizon}
            onChange={setHorizon}
            options={[0, 24, 48, 72]}
            label="FORECAST HORIZON:"
          />

          <div className="flex items-center gap-2">
            <span className="micro-label text-text-muted">VESSEL CLASS:</span>
            <select
              value={vessel.iceClass}
              onChange={(e) => updateVessel({ iceClass: e.target.value })}
              className="bg-surface-raised border border-border-subtle rounded px-2 py-0.5 text-[11px] font-mono text-text-primary focus:border-primary outline-none"
            >
              <option value="POLAR_CLASS_1">PC-1 (Heavy Icebreaker)</option>
              <option value="POLAR_CLASS_4">PC-4 (Thick First-Year)</option>
              <option value="POLAR_CLASS_5">PC-5 (Medium First-Year)</option>
              <option value="POLAR_CLASS_7">PC-7 (Thin Ice)</option>
              <option value="NONE">Unstrengthened</option>
            </select>
          </div>
        </div>

        <div className="flex items-center gap-gutter-sm">
          <Pill level="telemetry">5-LAYER POLARIS ENGINE</Pill>
          <Pill level={summary?.dataMode === "real" ? "safe" : "caution"}>
            {summary?.dataMode?.toUpperCase() ?? "DEMO"}
          </Pill>
        </div>
      </div>

      {/* Missing Layers Warning Banner */}
      {summary?.missingLayers && summary.missingLayers.length > 0 && (
        <div className="bg-status-caution/10 border border-status-caution/40 px-panel-pad-default py-1.5 flex items-center gap-2 text-[11px] font-mono text-status-caution rounded">
          <Icon name="warning" className="text-[16px]" />
          <span>
            DATA FALLBACK ACTIVE: Telemetry layers [{summary.missingLayers.join(", ")}] running on synthetic/climatology fallback models.
          </span>
        </div>
      )}

      {/* 4 KPI Threat Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-gutter-sm">
        <StatTile
          label="FIELD MEAN RISK"
          value={pct(summary?.meanRisk, 1)}
          status={summary && summary.meanRisk > 0.4 ? "danger" : undefined}
        />
        <StatTile
          label="PEAK CELL RISK"
          value={pct(summary?.maxRisk, 1)}
          status="danger"
        />
        <StatTile
          label="NAVIGABLE CELLS"
          value={num(summary?.cellsNavigable, 0)}
          status="safe"
        />
        <StatTile
          label="BLOCKED / IMPASSABLE"
          value={num(summary?.cellsBlocked, 0)}
          status="danger"
        />
      </div>

      {/* Main Viewport Workspace: 8-col Map + 4-col Analytics */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-gutter-md">
        {/* Central Tactical Heatmap Viewport */}
        <div className="xl:col-span-8 flex flex-col min-w-0">
          <Panel
            label="MULTI-FACTOR PASSAGE RISK HEATMAP"
            icon="warning"
            right={
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-mono text-text-muted">
                  CLICK ANY CELL TO INSPECT RISK BREAKDOWN
                </span>
              </div>
            }
            className="h-[640px] flex flex-col"
            contentClassName="flex-1 relative bg-surface-void overflow-hidden"
          >
            {riskMapQ.isLoading && (
              <div className="absolute inset-0 z-[1000] bg-surface-void/70 flex items-center justify-center">
                <Busy label="SYNTHESIZING 5-LAYER POLAR RISK MATRIX..." />
              </div>
            )}

            <PolarisMap
              center={[-66, 50]}
              zoom={3}
              onPointClick={(lat, lon) => setSelectedPoint({ lat, lon })}
              className="w-full h-full min-h-[500px]"
            >
              {riskMapQ.data && (
                <RiskHeatmapLayer
                  data={riskMapQ.data}
                  showHotspots={true}
                  onCellClick={(lat, lon) => setSelectedPoint({ lat, lon })}
                />
              )}
            </PolarisMap>

            {/* Map Legend */}
            <div className="absolute bottom-3 left-12 z-[1000] pointer-events-auto">
              <MapLegend type="risk" />
            </div>

            {/* Floating Point Risk Inspection Modal / Card */}
            {selectedPoint && (
              <div className="absolute top-3 left-3 z-[1000] w-80 bg-[#080e19]/95 border border-primary p-panel-pad-compact rounded shadow-2xl backdrop-blur-md font-mono">
                <div className="flex items-center justify-between pb-1 border-b border-border-subtle">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-primary animate-ping" />
                    <span className="font-bold text-primary text-[11px]">CELL RISK INSPECTOR</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedPoint(null)}
                    className="text-text-muted hover:text-text-primary text-[14px] cursor-pointer"
                  >
                    ✕
                  </button>
                </div>

                <div className="text-[10px] text-text-muted mt-1">
                  COORDINATES: {coord(selectedPoint.lat, selectedPoint.lon)}
                </div>

                {pointQ.isLoading ? (
                  <div className="py-4"><Busy label="EVALUATING RISK VECTORS..." /></div>
                ) : pointData ? (
                  <div className="flex flex-col gap-2 mt-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[12px] text-text-primary font-bold">TOTAL RISK:</span>
                      <span
                        className={`text-[15px] font-bold ${
                          pointData.totalRisk > 0.6 ? "text-status-danger" : "text-status-safe"
                        }`}
                      >
                        {pct(pointData.totalRisk, 1)}
                      </span>
                    </div>

                    <div className="w-full h-1.5 bg-surface-container-lowest border border-border-subtle overflow-hidden">
                      <div
                        className={`h-full ${
                          pointData.totalRisk > 0.6 ? "bg-status-danger" : "bg-status-safe"
                        }`}
                        style={{ width: `${Math.min(100, pointData.totalRisk * 100)}%` }}
                      />
                    </div>

                    <div className="flex flex-col gap-1 text-[10px] pt-1">
                      {[
                        ["Sea Ice Pack", pointData.seaIceRisk],
                        ["Iceberg Hazard", pointData.icebergRisk],
                        ["Weather Stress", pointData.weatherRisk],
                        ["Ocean Currents", pointData.oceanRisk],
                        ["Bathymetry/Constraint", pointData.constraintRisk],
                      ].map(([label, val]) => (
                        <div key={label as string} className="flex justify-between">
                          <span className="text-text-muted">{label}:</span>
                          <span className="text-text-primary font-semibold">{pct(val as number, 1)}</span>
                        </div>
                      ))}
                    </div>

                    <div className="pt-1 border-t border-border-subtle flex justify-between text-[10px]">
                      <span className="text-text-muted">Navigability:</span>
                      <span className={pointData.navigable ? "text-status-safe font-bold" : "text-status-danger font-bold"}>
                        {pointData.navigable ? "NAVIGABLE" : "BLOCKED FOR CLASS"}
                      </span>
                    </div>
                  </div>
                ) : null}
              </div>
            )}
          </Panel>
        </div>

        {/* Right Analytical Stack */}
        <div className="xl:col-span-4 flex flex-col gap-gutter-md min-w-0">
          {/* Panel 1: Component Breakdown */}
          <Panel label="5-COMPONENT FACTOR BREAKDOWN" icon="tune">
            <div className="flex flex-col gap-3">
              {[
                { label: "Sea Ice Concentration", key: "seaIce", weight: weights?.seaIce ?? 0.35, val: 0.42, color: "bg-primary" },
                { label: "Iceberg Collision Potential", key: "iceberg", weight: weights?.iceberg ?? 0.25, val: 0.28, color: "bg-status-danger" },
                { label: "Severe Weather / Wind", key: "weather", weight: weights?.weather ?? 0.15, val: 0.18, color: "bg-status-telemetry" },
                { label: "Ocean Current Stress", key: "ocean", weight: weights?.ocean ?? 0.10, val: 0.12, color: "bg-secondary" },
                { label: "Bathymetric Constraints", key: "constraint", weight: weights?.constraint ?? 0.15, val: 0.05, color: "bg-status-caution" },
              ].map((comp) => (
                <div key={comp.key} className="flex flex-col gap-1">
                  <div className="flex items-center justify-between text-[11px] font-mono">
                    <span className="text-text-primary">{comp.label}</span>
                    <span className="text-text-muted">Weight: {((comp.weight) * 100).toFixed(0)}%</span>
                  </div>
                  <div className="w-full h-2 bg-surface-container-lowest border border-border-subtle overflow-hidden rounded">
                    <div className={`h-full ${comp.color}`} style={{ width: `${comp.val * 100}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </Panel>

          {/* Panel 2: Tactical Hotspots Table */}
          <Panel
            label="CRITICAL RISK HOTSPOTS"
            icon="error"
            right={<Pill level="danger">{hotspots.length} DETECTED</Pill>}
          >
            <div className="flex flex-col gap-1.5 max-h-[260px] overflow-y-auto">
              {hotspots.length > 0 ? (
                hotspots.map((spot, idx) => (
                  <div
                    key={idx}
                    onClick={() => setSelectedPoint({ lat: spot.latitude, lon: spot.longitude })}
                    className="p-2 bg-surface-container-lowest border border-border-subtle hover:border-status-danger rounded flex items-center justify-between cursor-pointer transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <span className="w-5 h-5 rounded bg-status-danger/20 border border-status-danger text-status-danger font-mono text-[10px] font-bold flex items-center justify-center">
                        #{idx + 1}
                      </span>
                      <div>
                        <div className="text-[11px] font-mono font-bold text-text-primary">
                          {coord(spot.latitude, spot.longitude)}
                        </div>
                        <div className="text-[9px] font-mono text-text-muted">
                          FACTOR: <span className="text-primary">{spot.dominantComponent.toUpperCase()}</span>
                        </div>
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="text-[12px] font-mono font-bold text-status-danger">
                        {pct(spot.totalRisk, 0)}
                      </div>
                      <div className="text-[9px] font-mono text-text-muted">PEAK RISK</div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="py-4 text-center text-text-muted font-mono text-body-sm">
                  No extreme hotspots in current domain.
                </div>
              )}
            </div>
          </Panel>
        </div>
      </div>
    </div>
  );
}
