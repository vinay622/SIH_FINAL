import { useState, useMemo } from "react";
import { useAlerts, type TacticalAlert } from "../hooks/useAlerts";
import { coord } from "../lib/format";
import { Busy, Panel, Pill } from "../components/primitives";
import { Icon } from "../components/Icon";
import { PolarisMap } from "../components/map/PolarisMap";

export function TacticalAlerts() {
  const { alerts, activeCount, isLoading, toggleAcknowledge, clearAll } = useAlerts();

  const [severityFilter, setSeverityFilter] = useState<"all" | "critical" | "warning" | "advisory">("all");
  const [search, setSearch] = useState<string>("");
  const [selectedAlert, setSelectedAlert] = useState<TacticalAlert | null>(null);

  const filteredAlerts = useMemo(() => {
    return alerts.filter((a) => {
      if (severityFilter !== "all" && a.severity !== severityFilter) return false;
      if (search) {
        const query = search.toLowerCase();
        return (
          a.title.toLowerCase().includes(query) ||
          a.description.toLowerCase().includes(query) ||
          a.category.toLowerCase().includes(query)
        );
      }
      return true;
    });
  }, [alerts, severityFilter, search]);

  const criticalCount = alerts.filter((a) => a.severity === "critical" && !a.acknowledged).length;
  const warningCount = alerts.filter((a) => a.severity === "warning" && !a.acknowledged).length;
  const advisoryCount = alerts.filter((a) => a.severity === "advisory" && !a.acknowledged).length;

  const exportAlerts = () => {
    const dataStr = JSON.stringify(alerts, null, 2);
    const blob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `polaris-tactical-alerts-${new Date().toISOString().substring(0, 10)}.json`;
    link.click();
  };

  return (
    <div className="flex flex-col gap-gutter-md">
      {/* Top Command Bar */}
      <div className="glass-panel flex flex-wrap items-center justify-between gap-gutter-md px-panel-pad-default py-panel-pad-compact">
        <div className="flex flex-wrap items-center gap-gutter-md">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-status-danger animate-ping" />
            <span className="font-headline-sm text-headline-sm text-text-primary font-bold uppercase">
              TACTICAL ALERTS & REAL-TIME EVENT STREAM
            </span>
          </div>
          <span className="text-text-muted">|</span>
          <span className="font-telemetry-code text-telemetry-code text-text-muted">
            UNACKNOWLEDGED: <strong className="text-status-danger">{activeCount} HAZARDS</strong>
          </span>
        </div>

        <div className="flex items-center gap-gutter-sm">
          <button
            type="button"
            onClick={clearAll}
            className="px-3 py-1 bg-surface-raised border border-border-subtle hover:border-border-active text-text-secondary hover:text-text-primary font-mono text-[11px] font-bold rounded transition-colors"
          >
            ACKNOWLEDGE ALL
          </button>
          <button
            type="button"
            onClick={exportAlerts}
            className="px-3 py-1 bg-primary text-[#00363e] font-mono text-[11px] font-bold rounded shadow-[0_0_10px_rgba(138,235,255,0.35)] hover:brightness-110 transition-all flex items-center gap-1.5"
          >
            <Icon name="file_download" className="text-[14px]" />
            <span>EXPORT JSON</span>
          </button>
        </div>
      </div>

      {/* 3-Column Operational Command Bay */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-gutter-md items-start">
        {/* Column 1: Triage & Filters (3 cols) */}
        <div className="xl:col-span-3 flex flex-col gap-gutter-md min-w-0">
          <Panel label="FEED FILTER & TRIAGE" icon="tune">
            <div className="flex flex-col gap-gutter-md">
              {/* Search Bar */}
              <div className="relative">
                <Icon name="search" className="absolute left-2.5 top-2 text-text-muted text-[15px]" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Filter by keyword..."
                  className="w-full pl-8 pr-3 py-1.5 bg-surface-container-lowest border border-border-subtle rounded text-text-primary font-mono text-[11px] focus:border-primary outline-none"
                />
              </div>

              {/* Severity Buttons */}
              <div className="flex flex-col gap-1.5">
                <span className="micro-label text-text-muted">SEVERITY THRESHOLD</span>
                {[
                  ["all", "ALL INCIDENTS", alerts.length, "text-text-primary", "bg-surface-raised"],
                  ["critical", "CRITICAL / STOP-PROP", criticalCount, "text-status-danger", "bg-status-danger/15 border-status-danger/40"],
                  ["warning", "WARNING / ELEVATED", warningCount, "text-status-caution", "bg-status-caution/15 border-status-caution/40"],
                  ["advisory", "ADVISORY / TELEMETRY", advisoryCount, "text-status-telemetry", "bg-status-telemetry/15 border-status-telemetry/40"],
                ].map(([mode, label, count, textColor, bgStyle]) => (
                  <button
                    key={mode as string}
                    type="button"
                    onClick={() => setSeverityFilter(mode as typeof severityFilter)}
                    className={`flex items-center justify-between px-2.5 py-2 rounded font-mono text-[11px] font-bold border transition-all ${
                      severityFilter === mode
                        ? "border-primary shadow-[0_0_8px_rgba(138,235,255,0.3)] bg-primary/20 text-primary"
                        : `${bgStyle} ${textColor} border-border-subtle hover:border-border-active`
                    }`}
                  >
                    <span>{label}</span>
                    <span className="px-1.5 py-0.5 rounded bg-[#080e19] text-[10px]">
                      {count}
                    </span>
                  </button>
                ))}
              </div>

              {/* Instrument Bus Status */}
              <div className="flex flex-col gap-1.5 border-t border-border-subtle pt-2">
                <span className="micro-label text-text-muted">SUBSYSTEM HEALTH</span>
                {[
                  ["Radar & SAR Sentinel-1A", "ONLINE", "text-status-safe"],
                  ["RK4 Drift Trajectory Engine", "ONLINE", "text-status-safe"],
                  ["A* Route Synthesis Graph", "READY", "text-primary"],
                  ["ECMWF Weather Assimilation", "SYNCD", "text-status-telemetry"],
                  ["Hull Strain Gauges (PC-5)", "ACTIVE", "text-status-safe"],
                ].map(([name, stat, col]) => (
                  <div key={name} className="flex items-center justify-between text-[11px] font-mono">
                    <span className="text-text-secondary truncate">{name}</span>
                    <span className={`font-bold text-[10px] ${col}`}>{stat}</span>
                  </div>
                ))}
              </div>
            </div>
          </Panel>
        </div>

        {/* Column 2: Live Alert Feed (5 cols) */}
        <div className="xl:col-span-5 flex flex-col gap-gutter-sm min-w-0">
          <Panel
            label="INCIDENT FEED"
            icon="notifications_active"
            right={<Pill level="primary">{filteredAlerts.length} DISPLAYED</Pill>}
            className="h-[680px] flex flex-col"
            contentClassName="flex-1 flex flex-col gap-gutter-sm p-panel-pad-compact overflow-y-auto"
          >
            {isLoading && <Busy label="SCANNING TELEMETRY BUS..." />}

            {filteredAlerts.length > 0 ? (
              filteredAlerts.map((alert) => {
                const isCrit = alert.severity === "critical";
                const isWarn = alert.severity === "warning";
                const isSelected = selectedAlert?.id === alert.id;

                return (
                  <div
                    key={alert.id}
                    onClick={() => setSelectedAlert(alert)}
                    className={`p-panel-pad-compact rounded border cursor-pointer transition-all flex flex-col gap-1.5 ${
                      isSelected
                        ? "bg-surface-raised border-primary shadow-[0_0_12px_rgba(34,211,238,0.3)]"
                        : alert.acknowledged
                        ? "bg-surface-container-lowest/50 border-border-subtle opacity-60 hover:opacity-100"
                        : isCrit
                        ? "bg-status-danger/10 border-status-danger/60 hover:border-status-danger"
                        : isWarn
                        ? "bg-status-caution/10 border-status-caution/60 hover:border-status-caution"
                        : "bg-surface-panel border-border-subtle hover:border-border-active"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span
                          className={`w-2 h-2 rounded-full ${
                            isCrit
                              ? "bg-status-danger animate-ping"
                              : isWarn
                              ? "bg-status-caution"
                              : "bg-status-telemetry"
                          }`}
                        />
                        <span
                          className={`font-mono text-[11px] font-bold ${
                            isCrit
                              ? "text-status-danger"
                              : isWarn
                              ? "text-status-caution"
                              : "text-text-primary"
                          }`}
                        >
                          {alert.title}
                        </span>
                      </div>
                      <span className="font-mono text-[9px] text-text-muted">
                        {alert.timestamp.substring(11, 19)} UTC
                      </span>
                    </div>

                    <p className="text-[11px] font-mono text-text-secondary leading-relaxed">
                      {alert.description}
                    </p>

                    <div className="flex items-center justify-between pt-1 border-t border-border-subtle/50 text-[10px] font-mono">
                      {alert.latitude && alert.longitude ? (
                        <span className="text-primary">
                          📍 {coord(alert.latitude, alert.longitude)}
                        </span>
                      ) : (
                        <span className="text-text-muted">GLOBAL SENSOR BUS</span>
                      )}

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleAcknowledge(alert.id);
                        }}
                        className={`px-2 py-0.5 rounded font-bold transition-colors ${
                          alert.acknowledged
                            ? "bg-surface-container-high text-text-muted hover:text-text-primary"
                            : "bg-primary text-[#00363e] hover:brightness-110"
                        }`}
                      >
                        {alert.acknowledged ? "ACKNOWLEDGED" : "ACKNOWLEDGE"}
                      </button>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="py-12 text-center text-text-muted font-mono text-body-sm">
                No active incidents matching the selected filter criteria.
              </div>
            )}
          </Panel>
        </div>

        {/* Column 3: Tactical Incident Map (4 cols) */}
        <div className="xl:col-span-4 flex flex-col min-w-0">
          <Panel
            label="INCIDENT LOCALIZER"
            icon="radar"
            right={
              selectedAlert?.latitude ? (
                <Pill level="danger">LOCATED TARGET</Pill>
              ) : (
                <Pill level="telemetry">SURVEILLANCE</Pill>
              )
            }
            className="h-[680px] flex flex-col"
            contentClassName="flex-1 relative bg-surface-void overflow-hidden"
          >
            <PolarisMap
              center={
                selectedAlert?.latitude && selectedAlert?.longitude
                  ? [selectedAlert.latitude, selectedAlert.longitude]
                  : [-66, 50]
              }
              zoom={selectedAlert?.latitude ? 4 : 3}
              className="w-full h-full min-h-[500px]"
            />

            {selectedAlert && (
              <div className="absolute top-3 left-3 z-[1000] w-72 bg-[#080e19]/95 border border-primary p-panel-pad-compact rounded shadow-2xl font-mono text-[11px] backdrop-blur-md">
                <div className="flex items-center gap-1.5 text-primary font-bold">
                  <span className="w-2 h-2 rounded-full bg-primary animate-ping" />
                  <span>{selectedAlert.title}</span>
                </div>
                <div className="text-text-secondary text-[10px] mt-1">
                  {selectedAlert.description}
                </div>
                {selectedAlert.latitude && selectedAlert.longitude && (
                  <div className="text-primary font-bold text-[10px] mt-1">
                    {coord(selectedAlert.latitude, selectedAlert.longitude)}
                  </div>
                )}
              </div>
            )}
          </Panel>
        </div>
      </div>
    </div>
  );
}
