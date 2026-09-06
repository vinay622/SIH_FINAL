import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  getIcebergs,
  getIcebergTrajectory,
} from "../lib/api";
import { coord, num } from "../lib/format";
import { Busy, Failure, Panel, Pill } from "../components/primitives";
import { Icon } from "../components/Icon";
import { PolarisMap } from "../components/map/PolarisMap";
import { IcebergLayer } from "../components/map/IcebergLayer";

export function IcebergTracker() {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState<string>("");
  const [filterMode, setFilterMode] = useState<"all" | "domain" | "fast">("all");

  const icebergsQ = useQuery({
    queryKey: ["icebergs"],
    queryFn: () => getIcebergs(),
    staleTime: 60_000,
  });

  const selectedIcebergId = selectedId ?? icebergsQ.data?.icebergs?.[0]?.icebergId ?? null;

  const trajectoryQ = useQuery({
    queryKey: ["icebergs", selectedIcebergId, "trajectory"],
    queryFn: () => getIcebergTrajectory(selectedIcebergId!),
    enabled: Boolean(selectedIcebergId),
    staleTime: 5 * 60_000,
  });

  const filteredIcebergs = useMemo(() => {
    if (!icebergsQ.data?.icebergs) return [];
    return icebergsQ.data.icebergs.filter((b) => {
      const matchesSearch =
        !search ||
        b.icebergId.toLowerCase().includes(search.toLowerCase()) ||
        b.source.toLowerCase().includes(search.toLowerCase());

      if (!matchesSearch) return false;
      if (filterMode === "domain") return b.inDomain;
      if (filterMode === "fast") return b.driftSpeedM >= 0.15;
      return true;
    });
  }, [icebergsQ.data, search, filterMode]);

  const selectedBerg = useMemo(() => {
    return icebergsQ.data?.icebergs?.find((b) => b.icebergId === selectedIcebergId) ?? null;
  }, [icebergsQ.data, selectedIcebergId]);

  if (icebergsQ.isError) {
    return (
      <Failure
        message="ICEBERG TELEMETRY UNREACHABLE"
        hint="Failed to load radar/satellite tracked iceberg data."
      />
    );
  }

  return (
    <div className="flex flex-col gap-gutter-md">
      {/* Top Operational Context Strip */}
      <div className="glass-panel flex flex-wrap items-center justify-between gap-gutter-md px-panel-pad-default py-panel-pad-compact">
        <div className="flex flex-wrap items-center gap-gutter-md">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-status-danger animate-ping" />
            <span className="font-headline-sm text-headline-sm text-text-primary font-bold uppercase">
              TACTICAL ICE THREAT MATRIX
            </span>
          </div>
          <span className="text-text-muted">|</span>
          <span className="font-telemetry-code text-telemetry-code text-text-muted">
            TOTAL DETECTED: <strong className="text-text-primary">{icebergsQ.data?.count ?? 0} TARGETS</strong>
          </span>
          <span className="font-telemetry-code text-telemetry-code text-text-muted">
            IN DOMAIN:{" "}
            <strong className="text-status-danger">
              {icebergsQ.data?.icebergs?.filter((b) => b.inDomain).length ?? 0}
            </strong>
          </span>
        </div>

        <div className="flex items-center gap-gutter-sm">
          <Pill level="telemetry">NIC / SENTINEL-1A RADAR</Pill>
          <Pill level="safe">RK4 MODEL ACTIVE</Pill>
        </div>
      </div>

      {/* 3-Column Tactical Layout */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-gutter-md">
        {/* Left Column: Tracked Icebergs Inventory (4 cols) */}
        <div className="xl:col-span-4 flex flex-col min-w-0">
          <Panel
            label="TRACKED TARGETS"
            icon="radar"
            right={
              <Pill level="primary">
                {filteredIcebergs.length} / {icebergsQ.data?.count ?? 0}
              </Pill>
            }
            className="h-[680px] flex flex-col"
            contentClassName="flex-1 flex flex-col gap-gutter-sm p-panel-pad-compact overflow-hidden"
          >
            {/* Search and Filters */}
            <div className="flex flex-col gap-2">
              <div className="relative w-full">
                <Icon
                  name="search"
                  className="absolute left-2.5 top-2 text-text-muted text-[16px]"
                />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search berg ID or source..."
                  className="w-full pl-8 pr-3 py-1.5 bg-surface-container-lowest border border-border-subtle rounded text-text-primary font-mono text-[11px] focus:border-primary outline-none"
                />
              </div>

              <div className="flex items-center gap-1">
                {(
                  [
                    ["all", "ALL"],
                    ["domain", "IN DOMAIN"],
                    ["fast", "DRIFT > 0.15 M/S"],
                  ] as const
                ).map(([key, label]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setFilterMode(key)}
                    className={`px-2 py-1 text-[10px] font-mono font-semibold rounded transition-colors ${
                      filterMode === key
                        ? "bg-primary text-[#00363e] font-bold"
                        : "bg-surface-raised border border-border-subtle text-text-secondary hover:text-text-primary"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* Icebergs Table */}
            <div className="flex-1 overflow-y-auto border border-border-subtle rounded bg-surface-void/40">
              <table className="w-full text-left font-mono text-[11px] border-collapse">
                <thead className="sticky top-0 bg-surface-raised border-b border-border-subtle text-text-muted text-[10px]">
                  <tr>
                    <th className="py-2 px-2">ID</th>
                    <th className="py-2 px-2">LOCATION</th>
                    <th className="py-2 px-2">DRIFT</th>
                    <th className="py-2 px-2 text-right">AREA</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-subtle">
                  {filteredIcebergs.map((berg) => {
                    const isSelected = berg.icebergId === selectedIcebergId;
                    const isFast = berg.driftSpeedM >= 0.15;
                    return (
                      <tr
                        key={berg.icebergId}
                        onClick={() => setSelectedId(berg.icebergId)}
                        className={`cursor-pointer transition-colors ${
                          isSelected
                            ? "bg-primary/20 border-l-2 border-primary"
                            : "hover:bg-surface-container-high/60"
                        }`}
                      >
                        <td className="py-2 px-2">
                          <div className="flex items-center gap-1.5">
                            <span
                              className={`w-1.5 h-1.5 rounded-full ${
                                isFast ? "bg-status-danger animate-pulse" : "bg-primary"
                              }`}
                            />
                            <span className="font-bold text-text-primary">{berg.icebergId}</span>
                          </div>
                          <span className="text-[9px] text-text-muted uppercase">
                            {berg.source}
                          </span>
                        </td>
                        <td className="py-2 px-2 text-text-secondary">
                          <div>{berg.latitude.toFixed(2)}°S</div>
                          <div>{berg.longitude.toFixed(2)}°E</div>
                        </td>
                        <td className="py-2 px-2">
                          <div
                            className={
                              isFast ? "text-status-danger font-bold" : "text-text-primary"
                            }
                          >
                            {num(berg.driftSpeedM, 2)} m/s
                          </div>
                          <div className="text-[9px] text-text-muted">
                            {num(berg.driftBearingDeg, 0)}°
                          </div>
                        </td>
                        <td className="py-2 px-2 text-right font-bold text-text-primary">
                          {num(berg.areaKm2, 1)} km²
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Panel>
        </div>

        {/* Central Map Canvas (5 cols) */}
        <div className="xl:col-span-5 flex flex-col min-w-0">
          <Panel
            label="TACTICAL SITUATION & TRAJECTORY VIEWPORT"
            icon="public"
            right={
              trajectoryQ.data ? (
                <Pill level="safe">
                  {trajectoryQ.data.ensembleSize} MEMBER ENSEMBLE
                </Pill>
              ) : null
            }
            className="h-[680px] flex flex-col"
            contentClassName="flex-1 relative bg-surface-void overflow-hidden"
          >
            <PolarisMap
              center={
                selectedBerg
                  ? [selectedBerg.latitude, selectedBerg.longitude]
                  : [-65, 50]
              }
              zoom={selectedBerg ? 4 : 3}
              className="w-full h-full min-h-[500px]"
            >
              <IcebergLayer
                icebergs={icebergsQ.data?.icebergs}
                selectedIcebergId={selectedIcebergId}
                activeTrajectory={trajectoryQ.data}
                onSelectIceberg={(id) => setSelectedId(id)}
              />
            </PolarisMap>

            {/* Target callout pill overlay */}
            {selectedBerg && (
              <div className="absolute top-3 left-3 z-[1000] bg-[#080e19]/90 border border-primary p-2 rounded shadow-xl font-mono text-[11px]">
                <div className="flex items-center gap-1.5 text-primary font-bold">
                  <span className="w-2 h-2 rounded-full bg-primary animate-ping" />
                  <span>TARGET: {selectedBerg.icebergId}</span>
                </div>
                <div className="text-text-secondary text-[10px] mt-0.5">
                  {coord(selectedBerg.latitude, selectedBerg.longitude)}
                </div>
              </div>
            )}
          </Panel>
        </div>

        {/* Right Column: Selected Target Telemetry Dossier (3 cols) */}
        <div className="xl:col-span-3 flex flex-col min-w-0">
          <Panel
            label={selectedBerg ? `TARGET: ${selectedBerg.icebergId}` : "TARGET DETAILS"}
            icon="analytics"
            right={
              selectedBerg?.inDomain ? (
                <Pill level="danger">IN DOMAIN</Pill>
              ) : (
                <Pill level="telemetry">TRACKED</Pill>
              )
            }
            className="h-[680px] flex flex-col"
            contentClassName="flex-1 flex flex-col gap-gutter-md p-panel-pad-compact overflow-y-auto"
          >
            {selectedBerg ? (
              <>
                {/* 2x2 Telemetry Grid */}
                <div className="grid grid-cols-2 gap-2">
                  <div className="bg-surface-container-lowest p-2 rounded border border-border-subtle">
                    <span className="micro-label text-text-muted">AREA</span>
                    <div className="font-stat-metric text-[18px] text-text-primary font-bold">
                      {num(selectedBerg.areaKm2, 1)} <span className="text-[11px]">km²</span>
                    </div>
                  </div>
                  <div className="bg-surface-container-lowest p-2 rounded border border-border-subtle">
                    <span className="micro-label text-text-muted">DRIFT SPEED</span>
                    <div className="font-stat-metric text-[18px] text-status-caution font-bold">
                      {num(selectedBerg.driftSpeedM, 2)} <span className="text-[11px]">m/s</span>
                    </div>
                  </div>
                  <div className="bg-surface-container-lowest p-2 rounded border border-border-subtle">
                    <span className="micro-label text-text-muted">BEARING</span>
                    <div className="font-stat-metric text-[18px] text-primary font-bold">
                      {num(selectedBerg.driftBearingDeg, 0)}°
                    </div>
                  </div>
                  <div className="bg-surface-container-lowest p-2 rounded border border-border-subtle">
                    <span className="micro-label text-text-muted">SIZE</span>
                    <div className="font-stat-metric text-[15px] text-text-primary font-bold">
                      {num(selectedBerg.lengthNm, 1)} × {num(selectedBerg.widthNm, 1)} <span className="text-[10px]">NM</span>
                    </div>
                  </div>
                </div>

                {/* Trajectory Details */}
                <div className="flex flex-col gap-2 border-t border-border-subtle pt-2">
                  <div className="flex items-center justify-between">
                    <span className="micro-label text-text-muted">RK4 ENSEMBLE FORECAST</span>
                    <span className="font-telemetry-code text-[10px] text-primary">
                      {trajectoryQ.isLoading ? "COMPUTING..." : `${trajectoryQ.data?.points.length ?? 0} PTS`}
                    </span>
                  </div>

                  {trajectoryQ.isLoading && <Busy label="SOLVING DRIFT TRAJECTORY..." />}

                  {trajectoryQ.data?.points && (
                    <div className="flex flex-col gap-1.5 max-h-[220px] overflow-y-auto border border-border-subtle rounded p-1.5 bg-surface-void/40 font-mono text-[11px]">
                      {trajectoryQ.data.points.map((pt, i) => (
                        <div
                          key={i}
                          className="flex items-center justify-between py-1 px-1 border-b border-border-subtle last:border-0"
                        >
                          <span className="text-primary font-bold">+{pt.hoursAhead}h</span>
                          <span className="text-text-secondary">
                            {coord(pt.latitude, pt.longitude)}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Additional Metadata */}
                <div className="flex flex-col gap-1 text-[11px] font-mono border-t border-border-subtle pt-2 text-text-muted">
                  <div className="flex justify-between">
                    <span>Source Agency:</span>
                    <span className="text-text-primary">{selectedBerg.source}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Observations Logged:</span>
                    <span className="text-text-primary">{selectedBerg.nObservations}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Last Observation:</span>
                    <span className="text-text-primary truncate max-w-[140px]">
                      {selectedBerg.observedAt || "Recent"}
                    </span>
                  </div>
                </div>
              </>
            ) : (
              <div className="py-8 text-center text-text-muted font-mono text-body-sm">
                Select an iceberg to inspect target telemetry and compute RK4 trajectory.
              </div>
            )}
          </Panel>
        </div>
      </div>
    </div>
  );
}
