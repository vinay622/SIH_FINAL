/**
 * Fixed top HUD — header idiom from every Stitch screen (h-16, surface-raised,
 * emblem + POLARIS/NCPOR lockup, live telemetry chips, UTC clock, system status).
 *
 * All telemetry values are LIVE from /api/health — the Stitch mock values
 * (TEMP -18°C etc.) are replaced with real data.
 */

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { getHealth } from "../lib/api";
import { utcStamp } from "../lib/format";
import { Icon } from "./Icon";

function Clock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(t);
  }, []);
  return (
    <span className="font-telemetry-code text-telemetry-code text-text-primary font-bold tracking-wider">
      {utcStamp(now)}
    </span>
  );
}

function HealthPill({ status }: { status: string }) {
  const level = status === "ok" ? "safe" : status === "degraded" ? "caution" : "danger";
  const cls = { safe: "text-status-safe", caution: "text-status-caution", danger: "text-status-danger" }[level];
  const dot = { safe: "bg-status-safe", caution: "bg-status-caution", danger: "bg-status-danger" }[level];
  const label = status === "ok" ? "SYSTEM ONLINE" : `SYSTEM ${status.toUpperCase()}`;
  return (
    <div className="flex items-center gap-1.5">
      <span className={`inline-block w-2 h-2 ${dot} animate-pulse`} />
      <span className={`micro-label tracking-widest ${cls}`}>{label}</span>
    </div>
  );
}

export function HudBar({
  navigationOpen,
  onNavigationToggle,
}: {
  navigationOpen: boolean;
  onNavigationToggle: () => void;
}) {
  const { data: health } = useQuery({
    queryKey: ["health"],
    queryFn: getHealth,
    refetchInterval: 10_000,
  });

  return (
    <header className="fixed top-0 left-0 right-0 h-16 z-50 bg-surface-raised border-b border-border-subtle">
      <div className="h-16 w-full px-grid-margin flex items-center justify-between gap-gutter-sm">
        <div className="flex items-center gap-gutter-sm min-w-0">
          <button
            type="button"
            aria-label={navigationOpen ? "Close navigation" : "Open navigation"}
            aria-expanded={navigationOpen}
            aria-controls="primary-navigation"
            onClick={onNavigationToggle}
            className="w-9 h-9 shrink-0 grid place-items-center border border-border-subtle bg-surface-container-lowest text-primary hover:bg-surface-container-high transition-colors"
          >
            <Icon name={navigationOpen ? "close" : "menu"} className="text-[20px]" />
          </button>
          <img alt="POLARIS Polar Emblem" className="h-8 w-auto object-contain" src="/emblem.svg" />
          <div className="flex flex-col min-w-0">
            <div className="flex items-center gap-gutter-sm">
              <span className="font-headline-md text-headline-md font-bold tracking-tight text-text-primary uppercase">
                POLARIS
              </span>
              <span className="px-1.5 py-0.5 bg-surface-container-high border border-border-subtle text-primary micro-label">
                NCPOR
              </span>
            </div>
            <span className="hidden sm:block micro-label text-text-muted uppercase truncate">
              AI-Enabled Antarctic Navigation &amp; Decision Support System
            </span>
          </div>
        </div>

        <div className="hidden xl:flex items-center gap-gutter-sm">
          <div className="flex items-center gap-gutter-xs px-panel-pad-compact py-1 bg-surface-container-lowest border border-border-subtle">
            <Icon name="ac_unit" className="text-primary text-[16px]" />
            <span className="font-telemetry-code text-telemetry-code text-text-secondary">DATA MODE:</span>
            <span className="font-telemetry-code text-telemetry-code text-text-primary font-bold">
              {health?.dataMode?.toUpperCase() ?? "…"}
            </span>
          </div>
          <div className="flex items-center gap-gutter-xs px-panel-pad-compact py-1 bg-surface-container-lowest border border-border-subtle">
            <Icon name="satellite_alt" className="text-status-telemetry text-[16px]" />
            <span className="font-telemetry-code text-telemetry-code text-text-secondary">UPTIME:</span>
            <span className="font-telemetry-code text-telemetry-code text-text-primary font-bold">
              {health ? `${Math.floor(health.uptimeSeconds / 60)}m` : "…"}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-gutter-sm shrink-0">
          <div className="flex flex-col items-end">
            <Clock />
            {health ? (
              <HealthPill status={health.status} />
            ) : (
              <div className="flex items-center gap-1.5">
                <span className="inline-block w-2 h-2 bg-status-caution animate-pulse" />
                <span className="micro-label tracking-widest text-status-caution">CONNECTING…</span>
              </div>
            )}
          </div>
          <div className="hidden sm:block h-7 w-px bg-border-subtle" />
          <div className="hidden sm:flex w-8 h-8 rounded-full bg-primary items-center justify-center">
            <Icon name="person" className="text-on-primary text-[18px]" />
          </div>
        </div>
      </div>
    </header>
  );
}
