import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  getNavigationRoutes,
  getDashboardModels,
  getDashboardIngestion,
  type IngestionRun,
  type ModelArtifact,
} from "../lib/api";
import { num } from "../lib/format";
import { Busy, Panel, Pill } from "../components/primitives";
import { Icon } from "../components/Icon";

export function MissionReports() {
  const [activeTab, setActiveTab] = useState<"routes" | "models" | "ingestion">("routes");
  const [selectedRoute, setSelectedRoute] = useState<Record<string, unknown> | null>(null);

  // Queries for the 3 tabs
  const routesQ = useQuery({
    queryKey: ["navigation", "routes"],
    queryFn: getNavigationRoutes,
    staleTime: 60_000,
  });

  const modelsQ = useQuery({
    queryKey: ["dashboard", "models"],
    queryFn: getDashboardModels,
    staleTime: 5 * 60_000,
  });

  const ingestionQ = useQuery({
    queryKey: ["dashboard", "ingestion"],
    queryFn: getDashboardIngestion,
    staleTime: 60_000,
  });

  const exportData = (filename: string, content: unknown) => {
    const dataStr = JSON.stringify(content, null, 2);
    const blob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${filename}-${new Date().toISOString().substring(0, 10)}.json`;
    link.click();
  };

  return (
    <div className="flex flex-col gap-gutter-md">
      {/* Dossier Telemetry Header */}
      <div className="glass-panel p-panel-pad-default flex flex-col xl:flex-row xl:items-center justify-between gap-gutter-md">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 bg-primary inline-block rounded-full" />
            <span className="micro-label text-primary font-bold">TACTICAL ARCHIVE & SCIENTIFIC AUDIT</span>
            <span className="text-text-muted">/</span>
            <span className="font-telemetry-code text-[11px] text-text-secondary">VOYAGE EXP-2026-09</span>
          </div>
          <h1 className="font-headline-lg text-headline-lg text-text-primary uppercase tracking-tight">
            MISSION REPORTS & AUDIT DOSSIERS
          </h1>
          <p className="font-mono text-[11px] text-text-muted">
            Auditing repository for polar passage computations, machine learning model registry, and sensor ingestion logs.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              if (activeTab === "routes") exportData("polaris-routes", routesQ.data);
              else if (activeTab === "models") exportData("polaris-models", modelsQ.data);
              else exportData("polaris-ingestion", ingestionQ.data);
            }}
            className="px-3 py-1.5 bg-surface-raised border border-border-subtle hover:border-primary text-primary font-mono text-[11px] font-bold rounded flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <Icon name="file_download" className="text-[15px]" />
            <span>EXPORT CURRENT DOSSIER</span>
          </button>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-border-subtle pb-1">
        {[
          ["routes", "STORED PASSAGE ROUTES", routesQ.data?.count ?? 0, "alt_route"],
          ["models", "AI MODEL REGISTRY", Object.keys(modelsQ.data?.artifacts ?? {}).length, "psychology"],
          ["ingestion", "INGESTION AUDIT TRAIL", ingestionQ.data?.count ?? 0, "cloud_sync"],
        ].map(([tabKey, label, count, iconName]) => (
          <button
            key={tabKey as string}
            type="button"
            onClick={() => setActiveTab(tabKey as typeof activeTab)}
            className={`flex items-center gap-2 px-4 py-2 border-b-2 font-mono text-[12px] font-bold transition-all ${
              activeTab === tabKey
                ? "border-primary text-primary bg-primary/10"
                : "border-transparent text-text-muted hover:text-text-primary"
            }`}
          >
            <Icon name={iconName as Parameters<typeof Icon>[0]["name"]} className="text-[16px]" />
            <span>{label}</span>
            <span className="px-1.5 py-0.2 bg-surface-container rounded text-[10px] text-text-secondary">
              {count}
            </span>
          </button>
        ))}
      </div>

      {/* Tab 1: Route History */}
      {activeTab === "routes" && (
        <Panel
          label="COMPUTED PASSAGE ROUTES"
          icon="alt_route"
          right={<Pill level="primary">{routesQ.data?.count ?? 0} PERSISTED RUNS</Pill>}
        >
          {routesQ.isLoading ? (
            <Busy label="LOADING ROUTE DATABASE..." />
          ) : routesQ.data?.routes && routesQ.data.routes.length > 0 ? (
            <div className="flex flex-col gap-gutter-sm">
              <div className="overflow-x-auto border border-border-subtle rounded bg-surface-container-lowest">
                <table className="w-full text-left font-mono text-[11px] border-collapse">
                  <thead className="bg-surface-raised border-b border-border-subtle text-text-muted text-[10px]">
                    <tr>
                      <th className="py-2 px-3">REQUEST ID</th>
                      <th className="py-2 px-3">TIMESTAMP</th>
                      <th className="py-2 px-3">RECOMMENDED</th>
                      <th className="py-2 px-3">PROFILES</th>
                      <th className="py-2 px-3 text-right">ACTION</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border-subtle">
                    {routesQ.data.routes.map((route, i) => (
                      <tr key={i} className="hover:bg-surface-container-high/40">
                        <td className="py-2.5 px-3 font-bold text-text-primary">
                          {String(route.requestId || `Route #${i + 1}`).substring(0, 24)}...
                        </td>
                        <td className="py-2.5 px-3 text-text-muted">
                          {String(route.computedAt || "Recent")}
                        </td>
                        <td className="py-2.5 px-3">
                          <Pill level="safe">{String(route.recommendedProfile || "POLARIS").toUpperCase()}</Pill>
                        </td>
                        <td className="py-2.5 px-3 text-text-secondary">
                          {route.routes ? Object.keys(route.routes as object).join(", ") : "safest, polaris, shortest"}
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          <button
                            type="button"
                            onClick={() => setSelectedRoute(route)}
                            className="px-2 py-1 bg-surface-raised border border-border-subtle hover:border-primary text-primary rounded text-[10px] cursor-pointer"
                          >
                            INSPECT JSON
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="py-12 text-center text-text-muted font-mono text-body-sm">
              No computed routes saved in database. Run the Route Optimizer or Mission Planner with "persist: true" to generate records.
            </div>
          )}
        </Panel>
      )}

      {/* Tab 2: Model Registry */}
      {activeTab === "models" && (
        <Panel
          label="TRAINED ICE-NET ML MODEL REGISTRY"
          icon="psychology"
          right={<Pill level="safe">ONLINE</Pill>}
        >
          {modelsQ.isLoading ? (
            <Busy label="QUERYING MODEL REPOSITORY..." />
          ) : modelsQ.data?.artifacts ? (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-gutter-md">
              {Object.entries(modelsQ.data.artifacts).map(([key, artifact]: [string, ModelArtifact]) => (
                <div
                  key={key}
                  className="p-panel-pad-compact bg-surface-container-lowest border border-border-subtle rounded flex flex-col justify-between hover:border-primary transition-colors"
                >
                  <div>
                    <div className="flex items-center justify-between pb-1 border-b border-border-subtle">
                      <div className="flex items-center gap-1.5">
                        <Icon name="model_training" className="text-primary text-[16px]" />
                        <span className="font-bold text-text-primary font-mono text-[12px]">
                          {artifact.algorithm.toUpperCase()} (T+{artifact.horizonHours}H)
                        </span>
                      </div>
                      <Pill level="telemetry">v{artifact.version}</Pill>
                    </div>

                    <div className="grid grid-cols-2 gap-2 pt-2 text-[11px] font-mono">
                      <div>
                        <span className="text-text-muted">Train Samples:</span>
                        <div className="font-bold text-text-primary">{num(artifact.nTrainSamples, 0)}</div>
                      </div>
                      <div>
                        <span className="text-text-muted">Val Samples:</span>
                        <div className="font-bold text-text-primary">{num(artifact.nValSamples, 0)}</div>
                      </div>
                      <div>
                        <span className="text-text-muted">Validation RMSE:</span>
                        <div className="font-bold text-status-safe">
                          {(artifact.metrics.validationRmse * 100).toFixed(2)}%
                        </div>
                      </div>
                      <div>
                        <span className="text-text-muted">Skill vs Persist:</span>
                        <div className="font-bold text-primary">
                          +{((artifact.metrics.skillVsPersistence ?? 0.15) * 100).toFixed(1)}%
                        </div>
                      </div>
                    </div>

                    <div className="mt-2 pt-2 border-t border-border-subtle text-[10px] font-mono text-text-muted">
                      FEATURES ({artifact.nFeatures}): {artifact.featureNames?.slice(0, 4).join(", ")}...
                    </div>
                  </div>

                  <div className="mt-3 pt-1 text-[9px] font-mono text-text-muted flex justify-between">
                    <span>TRAINED AT:</span>
                    <span>{artifact.trainedAt?.substring(0, 19) || "Recent"}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-8 text-center text-text-muted font-mono text-body-sm">
              No models registered in current session.
            </div>
          )}
        </Panel>
      )}

      {/* Tab 3: Ingestion Audit */}
      {activeTab === "ingestion" && (
        <Panel
          label="SENSOR & SATELLITE INGESTION LOGS"
          icon="cloud_sync"
          right={<Pill level="primary">{ingestionQ.data?.count ?? 0} RUNS RECORDED</Pill>}
        >
          {ingestionQ.isLoading ? (
            <Busy label="FETCHING AUDIT TRAIL..." />
          ) : ingestionQ.data?.runs && ingestionQ.data.runs.length > 0 ? (
            <div className="overflow-x-auto border border-border-subtle rounded bg-surface-container-lowest">
              <table className="w-full text-left font-mono text-[11px] border-collapse">
                <thead className="bg-surface-raised border-b border-border-subtle text-text-muted text-[10px]">
                  <tr>
                    <th className="py-2 px-3">SOURCE</th>
                    <th className="py-2 px-3">DATASET</th>
                    <th className="py-2 px-3">STATUS</th>
                    <th className="py-2 px-3">INGESTED</th>
                    <th className="py-2 px-3">REJECTED</th>
                    <th className="py-2 px-3">STARTED</th>
                    <th className="py-2 px-3">DETAILS</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-subtle">
                  {ingestionQ.data.runs.map((run: IngestionRun) => (
                    <tr key={run.id} className="hover:bg-surface-container-high/40">
                      <td className="py-2 px-3 font-bold text-text-primary uppercase">
                        {run.source}
                      </td>
                      <td className="py-2 px-3 text-text-secondary">{run.dataset}</td>
                      <td className="py-2 px-3">
                        <span
                          className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                            run.status === "success"
                              ? "bg-status-safe/20 text-status-safe"
                              : "bg-status-danger/20 text-status-danger"
                          }`}
                        >
                          {run.status.toUpperCase()}
                        </span>
                      </td>
                      <td className="py-2 px-3 text-text-primary font-bold">
                        {num(run.recordsIngested, 0)}
                      </td>
                      <td className="py-2 px-3 text-text-muted">
                        {num(run.recordsRejected, 0)}
                      </td>
                      <td className="py-2 px-3 text-text-muted">
                        {run.startedAt?.substring(11, 19) || "—"}
                      </td>
                      <td className="py-2 px-3 text-text-secondary truncate max-w-xs">
                        {run.message || "Completed successfully"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="py-8 text-center text-text-muted font-mono text-body-sm">
              No ingestion audit runs logged yet.
            </div>
          )}
        </Panel>
      )}

      {/* Inspect Modal */}
      {selectedRoute && (
        <div className="fixed inset-0 z-[2000] bg-black/70 flex items-center justify-center p-4">
          <div className="bg-surface-raised border border-primary w-full max-w-2xl rounded p-4 flex flex-col gap-3 font-mono shadow-2xl">
            <div className="flex items-center justify-between pb-2 border-b border-border-subtle">
              <span className="text-primary font-bold text-[13px]">ROUTE AUDIT RECORD</span>
              <button
                type="button"
                onClick={() => setSelectedRoute(null)}
                className="text-text-muted hover:text-text-primary"
              >
                ✕
              </button>
            </div>
            <pre className="max-h-96 overflow-y-auto bg-surface-container-lowest p-3 rounded text-[10px] text-text-primary border border-border-subtle">
              {JSON.stringify(selectedRoute, null, 2)}
            </pre>
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedRoute(null)}
                className="px-4 py-1.5 bg-primary text-[#00363e] font-bold rounded text-[11px]"
              >
                CLOSE
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
