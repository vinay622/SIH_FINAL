import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  getNavigationStations,
  getIcebergs,
  getRiskMap,
  postRouteOptimize,
  type RouteOptimizeResponse,
} from "../lib/api";
import { num, pct } from "../lib/format";
import { Busy, Panel, Pill } from "../components/primitives";
import { Icon } from "../components/Icon";
import { PolarisMap } from "../components/map/PolarisMap";
import { RouteLayer } from "../components/map/RouteLayer";
import { RiskHeatmapLayer } from "../components/map/RiskHeatmapLayer";
import { IcebergLayer } from "../components/map/IcebergLayer";
import { useVessel } from "../hooks/useVessel";

export function MissionPlanner() {
  const { vessel, updateVessel } = useVessel();

  const [startStation, setStartStation] = useState<string>("bharati");
  const [destStation, setDestStation] = useState<string>("maitri");
  const [forecastHorizon, setForecastHorizon] = useState<number>(48);
  const [selectedProfile, setSelectedProfile] = useState<string>("polaris");
  const [showRiskHeatmap, setShowRiskHeatmap] = useState<boolean>(true);
  const [showIcebergs, setShowIcebergs] = useState<boolean>(true);

  // Stations query
  const stationsQ = useQuery({
    queryKey: ["navigation", "stations"],
    queryFn: getNavigationStations,
    staleTime: 60 * 60_000,
  });

  // Background risk map query
  const riskQ = useQuery({
    queryKey: ["risk", "map", { horizon: forecastHorizon, stride: 4 }],
    queryFn: () => getRiskMap({ horizon: forecastHorizon, stride: 4 }),
    staleTime: 5 * 60_000,
  });

  // Icebergs query
  const icebergsQ = useQuery({
    queryKey: ["icebergs"],
    queryFn: () => getIcebergs(),
    staleTime: 60_000,
  });

  // Route optimize mutation
  const optimizeMutation = useMutation<RouteOptimizeResponse, Error>({
    mutationFn: () =>
      postRouteOptimize({
        start: { station: startStation },
        destination: { station: destStation },
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
          forecastHours: forecastHorizon,
          algorithm: "astar",
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

  const routes = optimizeMutation.data?.routes;
  const recommended = optimizeMutation.data?.recommendedProfile;

  return (
    <div className="flex flex-col gap-gutter-md">
      {/* Console Sub-Header Bar */}
      <div className="glass-panel flex flex-wrap items-center justify-between gap-gutter-md px-panel-pad-default py-panel-pad-compact">
        <div className="flex flex-wrap items-center gap-gutter-md">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-primary animate-pulse" />
            <span className="font-headline-sm text-headline-sm text-text-primary font-bold uppercase">
              MISSION ORCHESTRATOR & AI ROUTE SYNTHESIZER
            </span>
          </div>
          <span className="text-text-muted">|</span>
          <span className="font-telemetry-code text-telemetry-code text-text-muted">
            VESSEL: <strong className="text-primary">{vessel.name}</strong> ({vessel.iceClass})
          </span>
          <span className="font-telemetry-code text-telemetry-code text-text-muted">
            CORRIDOR: <strong className="text-text-primary">{startStation.toUpperCase()} → {destStation.toUpperCase()}</strong>
          </span>
        </div>

        <div className="flex items-center gap-gutter-sm">
          <Pill level="telemetry">A* MULTI-OBJECTIVE</Pill>
          <Pill level={optimizeMutation.data ? "safe" : "caution"}>
            {optimizeMutation.data ? "SYNTHESIZED" : "STANDBY"}
          </Pill>
        </div>
      </div>

      {/* Tactical Workspace */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-gutter-md items-start">
        {/* Left Column: Mission Parameters & Voyage Tuning (4 cols) */}
        <div className="xl:col-span-4 flex flex-col gap-gutter-md">
          <Panel label="VOYAGE CONFIGURATION" icon="tune">
            <div className="flex flex-col gap-3">
              {/* Departure / Destination */}
              <div className="flex flex-col gap-1.5">
                <label className="micro-label text-text-muted">DEPARTURE STATION</label>
                <select
                  value={startStation}
                  onChange={(e) => setStartStation(e.target.value)}
                  className="bg-surface-container-lowest border border-border-active px-2.5 py-1.5 rounded text-text-primary font-mono text-[12px] focus:border-primary outline-none"
                >
                  {stationsQ.data?.stations ? (
                    stationsQ.data.stations.map((st) => (
                      <option key={st.key} value={st.key} disabled={st.inDomain === false}>
                        {st.name} ({st.region}) {st.inDomain === false ? "— [Out of Domain]" : ""}
                      </option>
                    ))
                  ) : (
                    <>
                      <option value="bharati">Bharati (Larsemann Hills)</option>
                      <option value="maitri">Maitri (Schirmacher Oasis)</option>
                      <option value="cape_town" disabled>Cape Town [Out of Domain]</option>
                    </>
                  )}
                </select>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="micro-label text-text-muted">DESTINATION STATION</label>
                <select
                  value={destStation}
                  onChange={(e) => setDestStation(e.target.value)}
                  className="bg-surface-container-lowest border border-border-active px-2.5 py-1.5 rounded text-text-primary font-mono text-[12px] focus:border-primary outline-none"
                >
                  {stationsQ.data?.stations ? (
                    stationsQ.data.stations.map((st) => (
                      <option key={st.key} value={st.key} disabled={st.inDomain === false}>
                        {st.name} ({st.region}) {st.inDomain === false ? "— [Out of Domain]" : ""}
                      </option>
                    ))
                  ) : (
                    <>
                      <option value="maitri">Maitri (Schirmacher Oasis)</option>
                      <option value="bharati">Bharati (Larsemann Hills)</option>
                      <option value="cape_town" disabled>Cape Town [Out of Domain]</option>
                    </>
                  )}
                </select>
              </div>

              {startStation === destStation && (
                <div className="text-[11px] font-mono text-status-caution bg-status-caution/10 border border-status-caution/30 px-2 py-1 rounded">
                  Departure and destination must be different stations.
                </div>
              )}

              {/* Vessel Profile Parameters */}
              <div className="flex flex-col gap-1.5 border-t border-border-subtle pt-2">
                <label className="micro-label text-text-muted">POLAR ICE CLASS</label>
                <select
                  value={vessel.iceClass}
                  onChange={(e) => updateVessel({ iceClass: e.target.value })}
                  className="bg-surface-container-lowest border border-border-active px-2.5 py-1.5 rounded text-text-primary font-mono text-[12px] focus:border-primary outline-none"
                >
                  <option value="icebreaker">Polar Icebreaker (Cap: 0.95)</option>
                  <option value="pc5">PC-5 Polar Class (Cap: 0.88)</option>
                  <option value="1a_super">1A Super Polar Research (Cap: 0.82)</option>
                  <option value="1a">1A Heavy Ice Conditions (Cap: 0.70)</option>
                  <option value="1b">1B Medium Ice Conditions (Cap: 0.55)</option>
                  <option value="1c">1C Light Ice Conditions (Cap: 0.45)</option>
                  <option value="none">Unstrengthened / Open Water (Cap: 0.30)</option>
                </select>
              </div>

              {/* Cruising Speed & Fuel */}
              <div className="grid grid-cols-2 gap-2">
                <div className="flex flex-col gap-1">
                  <label className="micro-label text-text-muted">SPEED (KN)</label>
                  <input
                    type="number"
                    value={vessel.speedKnots}
                    step="0.5"
                    onChange={(e) => updateVessel({ speedKnots: parseFloat(e.target.value) || 12 })}
                    className="bg-surface-container-lowest border border-border-active px-2 py-1 rounded text-text-primary font-mono text-[12px]"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="micro-label text-text-muted">DRAFT (M)</label>
                  <input
                    type="number"
                    value={vessel.draftM}
                    step="0.1"
                    onChange={(e) => updateVessel({ draftM: parseFloat(e.target.value) || 8.0 })}
                    className="bg-surface-container-lowest border border-border-active px-2 py-1 rounded text-text-primary font-mono text-[12px]"
                  />
                </div>
              </div>

              {/* Horizon */}
              <div className="flex flex-col gap-1.5">
                <label className="micro-label text-text-muted">FORECAST HORIZON</label>
                <div className="grid grid-cols-4 gap-1">
                  {[0, 24, 48, 72].map((h) => (
                    <button
                      key={h}
                      type="button"
                      onClick={() => setForecastHorizon(h)}
                      className={`py-1 text-[11px] font-mono font-bold rounded cursor-pointer ${
                        forecastHorizon === h
                          ? "bg-primary text-[#00363e]"
                          : "bg-surface-container-lowest text-text-muted hover:text-text-primary border border-border-subtle"
                      }`}
                    >
                      {h === 0 ? "T+0" : `+${h}h`}
                    </button>
                  ))}
                </div>
              </div>

              {/* Synthesize Button */}
              <button
                type="button"
                disabled={optimizeMutation.isPending || startStation === destStation}
                onClick={() => optimizeMutation.mutate()}
                className="w-full py-2.5 px-4 bg-gradient-to-r from-[#0EA5E9] to-primary-container text-surface-container-lowest font-headline-sm font-bold shadow-[0_0_14px_rgba(34,211,238,0.35)] hover:brightness-110 active:scale-98 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                <Icon name={optimizeMutation.isPending ? "sync" : "alt_route"} className={`text-[18px] ${optimizeMutation.isPending ? "animate-spin" : ""}`} />
                <span>{optimizeMutation.isPending ? "SYNTHESIZING ROUTES..." : "SYNTHESIZE ROUTE"}</span>
              </button>

              {optimizeMutation.isError && (
                <div className="p-2.5 bg-status-danger/10 border border-status-danger/40 rounded text-status-danger font-mono text-[11px] leading-relaxed break-words">
                  <div className="font-bold mb-1">Route Synthesis Failed:</div>
                  <div>{optimizeMutation.error.message}</div>
                </div>
              )}
            </div>
          </Panel>
        </div>

        {/* Right Column: Expanded Tactical Map Viewport (8 cols) */}
        <div className="xl:col-span-8 flex flex-col min-w-0">
          <Panel
            label="TACTICAL PASSAGE & RISK VIEWPORT"
            icon="public"
            right={
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-1.5 text-[11px] font-mono text-text-secondary cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showRiskHeatmap}
                    onChange={(e) => setShowRiskHeatmap(e.target.checked)}
                    className="accent-primary"
                  />
                  <span>RISK GRID</span>
                </label>
                <label className="flex items-center gap-1.5 text-[11px] font-mono text-text-secondary cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showIcebergs}
                    onChange={(e) => setShowIcebergs(e.target.checked)}
                    className="accent-primary"
                  />
                  <span>ICEBERGS</span>
                </label>
              </div>
            }
            className="h-[600px] flex flex-col"
            contentClassName="flex-1 relative bg-surface-void overflow-hidden"
          >
            {optimizeMutation.isPending && (
              <div className="absolute inset-0 z-[1000] bg-surface-void/80 backdrop-blur-xs flex flex-col items-center justify-center gap-3">
                <Busy label="SEARCHING OPTIMAL PASSAGES ACROSS A* POLAR GRAPH..." />
                <span className="font-mono text-[11px] text-text-muted">Evaluating bathymetry, pack ice density & iceberg intercepts (3–8s)</span>
              </div>
            )}

            <PolarisMap center={[-67.8, 44.0]} zoom={4} className="w-full h-full min-h-[500px]">
              {showRiskHeatmap && riskQ.data && <RiskHeatmapLayer data={riskQ.data} opacity={0.65} />}
              {showIcebergs && icebergsQ.data?.icebergs && (
                <IcebergLayer icebergs={icebergsQ.data.icebergs} />
              )}
              {routes && (
                <RouteLayer
                  routes={routes}
                  selectedProfile={selectedProfile}
                  autoFitBounds={true}
                  onRouteSelect={(p) => setSelectedProfile(p)}
                />
              )}
            </PolarisMap>
          </Panel>
        </div>

        {/* Lower Row: Full-Width 3-Column Route Evaluation Deck (12 cols) */}
        <div className="xl:col-span-12 flex flex-col min-w-0">
          <Panel
            label="MULTI-OBJECTIVE ROUTE EVALUATION MATRIX"
            icon="balance"
            right={
              recommended ? (
                <Pill level="safe">RECOMMENDED PROFILE: {recommended.toUpperCase()}</Pill>
              ) : null
            }
          >
            {routes ? (
              <div className="flex flex-col gap-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {Object.entries(routes).map(([profileKey, route]) => {
                    const isSelected = selectedProfile === profileKey;
                    const isRec = recommended === profileKey;
                    const themeColor =
                      profileKey === "polaris"
                        ? "#22d3ee"
                        : profileKey === "safest"
                        ? "#4ade80"
                        : "#facc15";

                    return (
                      <div
                        key={profileKey}
                        onClick={() => setSelectedProfile(profileKey)}
                        className={`p-4 border rounded-md cursor-pointer transition-all flex flex-col justify-between ${
                          isSelected
                            ? "bg-surface-raised border-primary shadow-[0_0_16px_rgba(34,211,238,0.25)] ring-1 ring-primary/40"
                            : "bg-surface-container-lowest border-border-subtle hover:border-border-active"
                        }`}
                      >
                        <div>
                          <div className="flex items-center justify-between pb-2 border-b border-border-subtle">
                            <div className="flex items-center gap-2">
                              <span
                                className="w-3 h-3 rounded-full"
                                style={{ backgroundColor: themeColor }}
                              />
                              <span className="font-headline-sm text-[14px] font-bold text-text-primary uppercase">
                                {profileKey}
                              </span>
                            </div>
                            <div className="flex items-center gap-1.5">
                              {isRec && <Pill level="safe">RECOMMENDED</Pill>}
                              {route.status === "degraded" && <Pill level="caution">DEGRADED</Pill>}
                            </div>
                          </div>

                          <div className="grid grid-cols-3 gap-3 py-3 text-[12px] font-mono border-b border-border-subtle">
                            <div>
                              <div className="micro-label text-text-muted">DISTANCE</div>
                              <div className="text-[16px] font-bold text-text-primary mt-0.5">
                                {num(route.distanceKm, 0)} <span className="text-[11px] font-normal text-text-muted">KM</span>
                              </div>
                              <div className="text-[10px] text-text-muted">~{num(route.distanceKm * 0.539957, 0)} NM</div>
                            </div>
                            <div>
                              <div className="micro-label text-text-muted">STEAMING TIME</div>
                              <div className="text-[16px] font-bold text-text-primary mt-0.5">
                                {num(route.durationHours, 1)} <span className="text-[11px] font-normal text-text-muted">H</span>
                              </div>
                              <div className="text-[10px] text-text-muted">~{(route.durationHours / 24).toFixed(1)} Days</div>
                            </div>
                            <div>
                              <div className="micro-label text-text-muted">EST. FUEL</div>
                              <div className="text-[16px] font-bold text-status-telemetry mt-0.5">
                                {num(route.estimatedFuelTonnes, 1)} <span className="text-[11px] font-normal text-text-muted">T</span>
                              </div>
                              <div className="text-[10px] text-text-muted">MDO burn</div>
                            </div>
                          </div>

                          <div className="grid grid-cols-3 gap-2 py-2 text-[11px] font-mono text-text-secondary">
                            <div>
                              <span className="text-text-muted">Mean Risk: </span>
                              <span className={`font-bold ${route.meanRisk > 0.4 ? "text-status-danger" : "text-status-safe"}`}>
                                {pct(route.meanRisk, 1)}
                              </span>
                            </div>
                            <div>
                              <span className="text-text-muted">Peak Ice: </span>
                              <span className="font-bold text-primary">
                                {pct(route.maxSeaIceConcentration, 0)}
                              </span>
                            </div>
                            <div>
                              <span className="text-text-muted">Waypoints: </span>
                              <span className="font-bold text-text-primary">{route.nWaypoints}</span>
                            </div>
                          </div>

                          {route.notes && route.notes.length > 0 && (
                            <div className="mt-2 p-2 bg-[#080e19]/60 border border-[#16263c] rounded text-[10px] font-mono text-text-muted leading-tight">
                              {route.notes[0]}
                            </div>
                          )}
                        </div>

                        <div className="pt-3 mt-3 border-t border-border-subtle">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedProfile(profileKey);
                              alert(`Mission profile '${profileKey.toUpperCase()}' committed to vessel ECDIS navigation log.`);
                            }}
                            className={`w-full py-2 rounded text-[11px] font-mono font-bold uppercase transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                              isSelected
                                ? "bg-primary text-[#00363e] shadow-[0_0_10px_rgba(34,211,238,0.4)]"
                                : "bg-surface-container-lowest border border-border-active text-text-secondary hover:text-text-primary hover:border-primary"
                            }`}
                          >
                            <Icon name="check_circle" className="text-[15px]" />
                            <span>{isSelected ? `COMMITTED (${profileKey.toUpperCase()})` : `SELECT & COMMIT`}</span>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="py-12 flex flex-col items-center gap-2 text-center text-text-muted font-mono text-body-sm">
                <Icon name="route" className="text-text-muted text-[40px]" />
                <p className="font-bold text-text-primary">Tactical Evaluation Standby</p>
                <p className="text-[12px]">Configure departure/destination stations and click "SYNTHESIZE ROUTE" to compute 3 multi-objective route candidates.</p>
              </div>
            )}
          </Panel>
        </div>
      </div>
    </div>
  );
}
