/**
 * App chrome + routing — every screen shares HudBar + NavRail + main content.
 * The DEMO banner is persistent while the backend reports dataMode === "demo"
 * (PLAN.md §10: mode isolation must be unmistakable to the operator).
 */

import { lazy, Suspense, useState } from "react";
import { Outlet, Route, BrowserRouter as Router, Routes } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { getHealth } from "./lib/api";
import { HudBar } from "./components/HudBar";
import { NavRail } from "./components/NavRail";
import { OpsConsole } from "./screens/OpsConsole";
import { VesselProvider } from "./hooks/useVessel";
import { Panel } from "./components/primitives";

const MissionPlanner = lazy(() => import("./screens/MissionPlanner").then(({ MissionPlanner: Screen }) => ({ default: Screen })));
const SeaIceForecast = lazy(() => import("./screens/SeaIceForecast").then(({ SeaIceForecast: Screen }) => ({ default: Screen })));
const IcebergTracker = lazy(() => import("./screens/IcebergTracker").then(({ IcebergTracker: Screen }) => ({ default: Screen })));
const RouteOptimizer = lazy(() => import("./screens/RouteOptimizer").then(({ RouteOptimizer: Screen }) => ({ default: Screen })));
const RiskAnalysis = lazy(() => import("./screens/RiskAnalysis").then(({ RiskAnalysis: Screen }) => ({ default: Screen })));
const WeatherOcean = lazy(() => import("./screens/WeatherOcean").then(({ WeatherOcean: Screen }) => ({ default: Screen })));
const TacticalAlerts = lazy(() => import("./screens/TacticalAlerts").then(({ TacticalAlerts: Screen }) => ({ default: Screen })));
const MissionReports = lazy(() => import("./screens/MissionReports").then(({ MissionReports: Screen }) => ({ default: Screen })));

function DemoBanner() {
  const { data: health } = useQuery({ queryKey: ["health"], queryFn: getHealth, refetchInterval: 10_000 });
  if (health?.dataMode !== "demo") return null;
  return (
    <div className="bg-status-caution/10 border-y border-status-caution/40 px-grid-margin py-1.5">
      <p className="font-telemetry-code text-telemetry-code text-status-caution text-center">
        ⚠ DEMO DATA MODE — SYNTHETIC SEED, NOT FOR NAVIGATION. Set DATA_MODE=real with configured sources to go live.
      </p>
    </div>
  );
}

function NotFound() {
  return (
    <Panel label="404 — SECTOR NOT FOUND" icon="warning">
      <div className="py-12 flex flex-col items-center gap-gutter-sm text-center">
        <span className="font-headline-md text-headline-md text-text-primary">COORDINATES UNCHARTED</span>
        <span className="font-telemetry-code text-telemetry-code text-text-muted">Return to operations console or select a primary mission track.</span>
      </div>
    </Panel>
  );
}

function ScreenLoading() {
  return <div className="min-h-[40vh] grid place-items-center"><span className="micro-label text-text-muted animate-pulse">LOADING MISSION VIEW…</span></div>;
}

function Layout() {
  const [navigationOpen, setNavigationOpen] = useState(false);

  return (
    <div className="min-h-screen bg-surface-container-lowest">
      <HudBar navigationOpen={navigationOpen} onNavigationToggle={() => setNavigationOpen((open) => !open)} />
      <NavRail open={navigationOpen} onClose={() => setNavigationOpen(false)} />
      <DemoBanner />
      <main className="pt-16 md:pt-[4.5rem] xl:pt-[4.75rem] pb-20 md:pb-6 px-grid-margin max-w-[1800px] mx-auto">
        <Outlet />
      </main>
    </div>
  );
}

export default function App() {
  return (
    <VesselProvider>
      <Router basename={import.meta.env.BASE_URL}>
        <Suspense fallback={<ScreenLoading />}>
          <Routes>
            <Route element={<Layout />}>
              <Route path="/" element={<OpsConsole />} />
              <Route path="/planner" element={<MissionPlanner />} />
              <Route path="/sea-ice" element={<SeaIceForecast />} />
              <Route path="/icebergs" element={<IcebergTracker />} />
              <Route path="/route" element={<RouteOptimizer />} />
              <Route path="/risk" element={<RiskAnalysis />} />
              <Route path="/weather" element={<WeatherOcean />} />
              <Route path="/alerts" element={<TacticalAlerts />} />
              <Route path="/reports" element={<MissionReports />} />
              <Route path="*" element={<NotFound />} />
            </Route>
          </Routes>
        </Suspense>
      </Router>
    </VesselProvider>
  );
}
