import { useState, useEffect } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  postRouteOptimize,
  getNavigationRoutes,
  type RouteOptimizeResponse,
} from "../lib/api";
import { num, pct } from "../lib/format";
import { Busy, Panel, Pill } from "../components/primitives";
import { Icon } from "../components/Icon";
import { PolarisMap } from "../components/map/PolarisMap";
import { RouteLayer } from "../components/map/RouteLayer";
import { useVessel } from "../hooks/useVessel";

export function RouteOptimizer() {
  const { vessel } = useVessel();

  const [preset, setPreset] = useState<"safest" | "fuel" | "shortest" | "custom">("safest");
  const [riskWeight, setRiskWeight] = useState<number>(6.0);
  const [fuelWeight, setFuelWeight] = useState<number>(2.5);
  const [distanceWeight, setDistanceWeight] = useState<number>(1.5);
  const [algorithm, setAlgorithm] = useState<"astar" | "dijkstra">("astar");
  const [selectedProfile, setSelectedProfile] = useState<string>("polaris");

  // Load recent routes from history
  const historyQ = useQuery({
    queryKey: ["navigation", "routes"],
    queryFn: getNavigationRoutes,
    staleTime: 60_000,
  });

  // Optimize mutation
  const optimizeMutation = useMutation<RouteOptimizeResponse, Error>({
    mutationFn: () =>
      postRouteOptimize({
        start: { station: "bharati" },
        destination: { station: "maitri" },
        vessel: {
          name: vessel.name,
          iceClass: vessel.iceClass,
          speedKnots: vessel.speedKnots,
          fuelConsumptionTpd: vessel.fuelConsumptionTpd,
          draftM: vessel.draftM,
          riskTolerance: vessel.riskTolerance,
        },
        preferences: {
          profiles: ["shortest", "safest", "polaris"],
          algorithm,
          riskWeight,
          fuelWeight,
          distanceWeight,
          includeIcebergAnalysis: true,
        },
        persist: true,
      }),
    onSuccess: (data) => {
      if (data.recommendedProfile) {
        setSelectedProfile(data.recommendedProfile);
      }
    },
  });

  // Run an initial optimization on mount
  useEffect(() => {
    optimizeMutation.mutate();
  }, []);

  const handlePreset = (mode: "safest" | "fuel" | "shortest" | "custom") => {
    setPreset(mode);
    if (mode === "safest") {
      setRiskWeight(6.0);
      setFuelWeight(2.0);
      setDistanceWeight(1.0);
    } else if (mode === "fuel") {
      setRiskWeight(2.5);
      setFuelWeight(6.0);
      setDistanceWeight(1.5);
    } else if (mode === "shortest") {
      setRiskWeight(1.0);
      setFuelWeight(1.5);
      setDistanceWeight(6.0);
    }
  };

  const routes = optimizeMutation.data?.routes;
  const totalWeight = riskWeight + fuelWeight + distanceWeight || 1;
  const riskPct = Math.round((riskWeight / totalWeight) * 100);
  const fuelPct = Math.round((fuelWeight / totalWeight) * 100);
  const distPct = 100 - riskPct - fuelPct;

  return (
    <div className="flex flex-col gap-gutter-md">
      {/* Top Command Bar: Weight Tuning & Presets */}
      <div className="glass-panel flex flex-col gap-gutter-sm p-panel-pad-compact">
        <div className="flex flex-wrap items-center justify-between gap-gutter-sm">
          <div className="flex items-center gap-gutter-md">
            <div className="flex items-center gap-1.5">
              <Icon name="alt_route" className="text-primary text-[20px]" />
              <span className="font-headline-sm text-headline-sm text-text-primary font-bold uppercase">
                TACTICAL ROUTE SYNTHESIS & MULTI-OBJECTIVE OPTIMIZER
              </span>
            </div>
            <span className="font-telemetry-code text-telemetry-code text-text-muted hidden md:inline">
              BHARATI → MAITRI
            </span>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 px-2 py-0.5 bg-surface-container-lowest border border-border-subtle rounded">
              <span className="w-2 h-2 rounded-full bg-status-safe animate-pulse" />
              <span className="font-mono text-[11px] text-status-safe font-bold">
                ALGO: {algorithm.toUpperCase()}
              </span>
            </div>
            <button
              type="button"
              onClick={() => setAlgorithm((a) => (a === "astar" ? "dijkstra" : "astar"))}
              className="px-2 py-0.5 bg-surface-raised border border-border-subtle rounded text-[10px] font-mono text-text-secondary hover:text-text-primary"
            >
              SWITCH TO {algorithm === "astar" ? "DIJKSTRA" : "A*"}
            </button>
          </div>
        </div>

        {/* Sliders and Presets Row */}
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-gutter-md items-center pt-1 border-t border-border-subtle">
          {/* Preset Buttons */}
          <div className="xl:col-span-4 flex items-center gap-1">
            <span className="micro-label text-text-muted mr-1">OBJECTIVE:</span>
            {(
              [
                ["safest", "SAFEST"],
                ["fuel", "FUEL OPT"],
                ["shortest", "SHORTEST"],
                ["custom", "CUSTOM"],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => handlePreset(key)}
                className={`flex-1 py-1 px-2 text-center font-mono text-[11px] font-bold rounded transition-colors ${
                  preset === key
                    ? "bg-primary text-[#00363e] shadow-[0_0_10px_rgba(138,235,255,0.4)]"
                    : "bg-surface-container-lowest text-text-secondary hover:text-text-primary border border-border-subtle"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Sliders */}
          <div className="xl:col-span-6 flex flex-wrap sm:flex-nowrap items-center justify-between gap-gutter-md px-3 py-1.5 bg-surface-container-lowest rounded border border-border-subtle">
            <div className="flex-1 min-w-[120px] flex flex-col gap-0.5">
              <div className="flex justify-between font-mono text-[10px]">
                <span className="text-text-muted">SAFETY ({riskWeight.toFixed(1)})</span>
                <span className="text-primary font-bold">{riskPct}%</span>
              </div>
              <input
                type="range"
                min="0.5"
                max="10"
                step="0.5"
                value={riskWeight}
                onChange={(e) => {
                  setRiskWeight(parseFloat(e.target.value));
                  setPreset("custom");
                }}
                className="w-full h-1 bg-surface-raised accent-primary cursor-pointer"
              />
            </div>

            <div className="flex-1 min-w-[120px] flex flex-col gap-0.5">
              <div className="flex justify-between font-mono text-[10px]">
                <span className="text-text-muted">FUEL ({fuelWeight.toFixed(1)})</span>
                <span className="text-status-telemetry font-bold">{fuelPct}%</span>
              </div>
              <input
                type="range"
                min="0.5"
                max="10"
                step="0.5"
                value={fuelWeight}
                onChange={(e) => {
                  setFuelWeight(parseFloat(e.target.value));
                  setPreset("custom");
                }}
                className="w-full h-1 bg-surface-raised accent-status-telemetry cursor-pointer"
              />
            </div>

            <div className="flex-1 min-w-[120px] flex flex-col gap-0.5">
              <div className="flex justify-between font-mono text-[10px]">
                <span className="text-text-muted">DISTANCE ({distanceWeight.toFixed(1)})</span>
                <span className="text-status-caution font-bold">{distPct}%</span>
              </div>
              <input
                type="range"
                min="0.5"
                max="10"
                step="0.5"
                value={distanceWeight}
                onChange={(e) => {
                  setDistanceWeight(parseFloat(e.target.value));
                  setPreset("custom");
                }}
                className="w-full h-1 bg-surface-raised accent-status-caution cursor-pointer"
              />
            </div>
          </div>

          {/* Re-Synthesize CTA */}
          <div className="xl:col-span-2 flex justify-end">
            <button
              type="button"
              disabled={optimizeMutation.isPending}
              onClick={() => optimizeMutation.mutate()}
              className="w-full py-1.5 px-3 bg-gradient-to-r from-[#0EA5E9] to-primary-container text-surface-container-lowest font-headline-sm font-bold shadow-[0_0_12px_rgba(34,211,238,0.35)] hover:brightness-110 active:scale-98 transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <Icon name={optimizeMutation.isPending ? "sync" : "auto_awesome"} className={`text-[16px] ${optimizeMutation.isPending ? "animate-spin" : ""}`} />
              <span>{optimizeMutation.isPending ? "SOLVING..." : "RE-SYNTHESIZE"}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Grid: Map & Matrix */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-gutter-md items-start">
        {/* Left / Center Map (7 cols) */}
        <div className="xl:col-span-7 flex flex-col min-w-0">
          <Panel
            label="MULTI-ROUTE TRAJECTORY EVALUATION"
            icon="public"
            right={
              routes ? (
                <div className="flex items-center gap-2">
                  <Pill level="primary">{Object.keys(routes).length} PROFILES OVERLAID</Pill>
                </div>
              ) : null
            }
            className="h-[640px] flex flex-col"
            contentClassName="flex-1 relative bg-surface-void overflow-hidden"
          >
            {optimizeMutation.isPending && (
              <div className="absolute inset-0 z-[1000] bg-surface-void/80 flex flex-col items-center justify-center gap-2">
                <Busy label="COMPUTING A* PARETO OPTIMAL TRAJECTORIES..." />
              </div>
            )}

            <PolarisMap center={[-67.8, 44.0]} zoom={4} className="w-full h-full min-h-[500px]">
              {routes && (
                <RouteLayer
                  routes={routes}
                  selectedProfile={selectedProfile}
                  autoFitBounds={true}
                  onRouteSelect={(p) => setSelectedProfile(p)}
                />
              )}
            </PolarisMap>

            {/* Profile Legend Pill Overlay */}
            <div className="absolute bottom-3 left-12 z-[1000] bg-[#080e19]/90 border border-[#16263c] p-2 rounded shadow-xl font-mono text-[10px]">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-1 bg-[#22d3ee] rounded" />
                  <span className="text-text-primary">POLARIS</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-1 bg-[#4ade80] rounded" />
                  <span className="text-text-primary">SAFEST</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-1 bg-[#facc15] rounded" />
                  <span className="text-text-primary">SHORTEST</span>
                </div>
              </div>
            </div>
          </Panel>
        </div>

        {/* Right Comparison Column (5 cols) */}
        <div className="xl:col-span-5 flex flex-col gap-gutter-md min-w-0">
          {/* Detailed Matrix Table */}
          <Panel label="ROUTE PROFILE MATRIX" icon="table_chart">
            {routes ? (
              <div className="flex flex-col gap-gutter-sm">
                <div className="overflow-x-auto">
                  <table className="w-full text-left font-mono text-[11px] border-collapse">
                    <thead className="border-b border-border-subtle text-text-muted text-[10px]">
                      <tr>
                        <th className="py-1.5 px-2">METRIC</th>
                        <th className="py-1.5 px-2 text-[#22d3ee]">POLARIS</th>
                        <th className="py-1.5 px-2 text-[#4ade80]">SAFEST</th>
                        <th className="py-1.5 px-2 text-[#facc15]">SHORTEST</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border-subtle">
                      <tr>
                        <td className="py-1.5 px-2 text-text-muted">Distance</td>
                        <td className="py-1.5 px-2 font-bold">{num(routes.polaris?.distanceKm, 0)} km</td>
                        <td className="py-1.5 px-2">{num(routes.safest?.distanceKm, 0)} km</td>
                        <td className="py-1.5 px-2">{num(routes.shortest?.distanceKm, 0)} km</td>
                      </tr>
                      <tr>
                        <td className="py-1.5 px-2 text-text-muted">Duration</td>
                        <td className="py-1.5 px-2 font-bold text-primary">{num(routes.polaris?.durationHours, 1)} h</td>
                        <td className="py-1.5 px-2">{num(routes.safest?.durationHours, 1)} h</td>
                        <td className="py-1.5 px-2">{num(routes.shortest?.durationHours, 1)} h</td>
                      </tr>
                      <tr>
                        <td className="py-1.5 px-2 text-text-muted">Fuel Est.</td>
                        <td className="py-1.5 px-2 font-bold">{num(routes.polaris?.estimatedFuelTonnes, 1)} t</td>
                        <td className="py-1.5 px-2">{num(routes.safest?.estimatedFuelTonnes, 1)} t</td>
                        <td className="py-1.5 px-2">{num(routes.shortest?.estimatedFuelTonnes, 1)} t</td>
                      </tr>
                      <tr>
                        <td className="py-1.5 px-2 text-text-muted">Mean Risk</td>
                        <td className="py-1.5 px-2 font-bold text-status-safe">{pct(routes.polaris?.meanRisk, 1)}</td>
                        <td className="py-1.5 px-2 text-status-safe">{pct(routes.safest?.meanRisk, 1)}</td>
                        <td className="py-1.5 px-2 text-status-danger font-bold">{pct(routes.shortest?.meanRisk, 1)}</td>
                      </tr>
                      <tr>
                        <td className="py-1.5 px-2 text-text-muted">Peak Risk</td>
                        <td className="py-1.5 px-2">{pct(routes.polaris?.maxRisk, 1)}</td>
                        <td className="py-1.5 px-2">{pct(routes.safest?.maxRisk, 1)}</td>
                        <td className="py-1.5 px-2 text-status-danger">{pct(routes.shortest?.maxRisk, 1)}</td>
                      </tr>
                      <tr>
                        <td className="py-1.5 px-2 text-text-muted">Max Sea Ice</td>
                        <td className="py-1.5 px-2">{pct(routes.polaris?.maxSeaIceConcentration, 0)}</td>
                        <td className="py-1.5 px-2">{pct(routes.safest?.maxSeaIceConcentration, 0)}</td>
                        <td className="py-1.5 px-2 text-status-danger">{pct(routes.shortest?.maxSeaIceConcentration, 0)}</td>
                      </tr>
                      <tr>
                        <td className="py-1.5 px-2 text-text-muted">Waypoints</td>
                        <td className="py-1.5 px-2">{routes.polaris?.nWaypoints}</td>
                        <td className="py-1.5 px-2">{routes.safest?.nWaypoints}</td>
                        <td className="py-1.5 px-2">{routes.shortest?.nWaypoints}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {/* Selected Profile Highlight Card */}
                {routes[selectedProfile] && (
                  <div className="p-panel-pad-compact bg-surface-raised border border-primary rounded mt-2">
                    <div className="flex items-center justify-between pb-1 border-b border-border-subtle">
                      <span className="micro-label text-primary font-bold">
                        ACTIVE SELECTION: {selectedProfile.toUpperCase()}
                      </span>
                      <Pill level="safe">COMMITTED CANDIDATE</Pill>
                    </div>
                    <p className="text-[11px] font-mono text-text-secondary pt-1.5 leading-relaxed">
                      Optimized for {vessel.name} ({vessel.iceClass}). Predicted safe corridor avoids A17 tabular iceberg drift cone and Prydz Bay heavy consolidation pack.
                    </p>
                  </div>
                )}
              </div>
            ) : (
              <div className="py-8 text-center text-text-muted font-mono text-body-sm">
                Route comparison matrix pending solver run.
              </div>
            )}
          </Panel>

          {/* Recent Stored Routes */}
          <Panel label="ROUTE AUDIT LOG" icon="history">
            <div className="flex flex-col gap-1.5 max-h-[160px] overflow-y-auto font-mono text-[11px]">
              {historyQ.data?.routes && historyQ.data.routes.length > 0 ? (
                historyQ.data.routes.slice(0, 5).map((r, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between p-1.5 bg-surface-container-lowest border border-border-subtle rounded"
                  >
                    <span className="text-text-primary truncate">
                      {String(r.requestId || `Route #${i + 1}`).substring(0, 16)}...
                    </span>
                    <span className="text-text-muted text-[10px]">
                      {String(r.computedAt || "Recent").substring(0, 10)}
                    </span>
                  </div>
                ))
              ) : (
                <div className="py-2 text-center text-text-muted text-[11px]">
                  No past stored routes in database.
                </div>
              )}
            </div>
          </Panel>
        </div>
      </div>
    </div>
  );
}
