/**
 * Shared primitives — the recurring panel/stat/badge idioms from every Stitch
 * screen, parameterized once so all 9 screens stay visually identical.
 *
 * Panel anatomy (from the designs): glass panel, border-subtle, zero radius,
 * header row with micro-label + optional live indicator, dense content area.
 */

import type { ReactNode } from "react";
import { Icon, type IconName } from "./Icon";

// ---------- panel ----------

export function Panel({
  label,
  icon,
  right,
  children,
  className = "",
  contentClassName = "p-panel-pad-default",
}: {
  label?: string;
  icon?: IconName;
  right?: ReactNode;
  children: ReactNode;
  className?: string;
  contentClassName?: string;
}) {
  return (
    <section className={`glass-panel ${className}`}>
      {label && (
        <header className="flex items-center justify-between gap-gutter-sm px-panel-pad-default py-panel-pad-dense border-b border-border-subtle">
          <div className="flex items-center gap-gutter-sm min-w-0">
            {icon && <Icon name={icon} className="text-primary text-[16px] shrink-0" />}
            <h2 className="micro-label text-text-secondary truncate">{label}</h2>
          </div>
          {right}
        </header>
      )}
      <div className={contentClassName}>{children}</div>
    </section>
  );
}

// ---------- stat tile ----------

export function StatTile({
  label,
  value,
  unit,
  trend,
  status,
}: {
  label: string;
  value: string;
  unit?: string;
  trend?: "up" | "down" | "flat";
  status?: "safe" | "caution" | "danger" | "telemetry";
}) {
  const trendColor =
    trend === "up" ? "text-status-caution" : trend === "down" ? "text-status-safe" : "text-text-muted";
  const valueColor =
    status === "safe"
      ? "text-status-safe"
      : status === "caution"
        ? "text-status-caution"
        : status === "danger"
          ? "text-status-danger"
          : status === "telemetry"
            ? "text-status-telemetry"
            : "text-text-primary";
  return (
    <div className="bg-surface-container-lowest border border-border-subtle px-panel-pad-compact py-panel-pad-dense">
      <div className="micro-label text-text-muted truncate">{label}</div>
      <div className="flex items-baseline gap-gutter-xs pt-1">
        <span className={`font-stat-metric text-stat-metric ${valueColor}`}>{value}</span>
        {unit && <span className="font-telemetry-code text-telemetry-code text-text-secondary">{unit}</span>}
        {trend && (
          <Icon
            name={trend === "flat" ? "trending_flat" : trend === "up" ? "trending_up" : "trending_down"}
            className={`${trendColor} text-[16px]`}
          />
        )}
      </div>
    </div>
  );
}

// ---------- status pill ----------

export type PillLevel = "safe" | "caution" | "danger" | "telemetry" | "neutral" | "primary";

const PILL: Record<PillLevel, string> = {
  safe: "bg-surface-container-lowest text-status-safe border-status-safe/40",
  caution: "bg-surface-container-lowest text-status-caution border-status-caution/40",
  danger: "bg-surface-container-lowest text-status-danger border-status-danger/40",
  telemetry: "bg-surface-container-lowest text-status-telemetry border-status-telemetry/40",
  neutral: "bg-surface-container-lowest text-text-secondary border-border-subtle",
  primary: "bg-surface-container-lowest text-primary border-primary/40",
};

export function Pill({
  level,
  children,
  pulse,
  className = "",
}: {
  level: PillLevel;
  children: ReactNode;
  pulse?: boolean;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center gap-gutter-xs px-2 py-0.5 border font-micro-label text-micro-label uppercase ${PILL[level]} ${className}`}
    >
      {pulse && <span className="inline-block w-1.5 h-1.5 bg-current animate-pulse" />}
      {children}
    </span>
  );
}

// ---------- risk meter (horizontal segmented bar, zero radius) ----------

export function RiskMeter({ risk, segments = 20 }: { risk: number; segments?: number }) {
  const filled = Math.round(Math.min(risk, 1) * segments);
  const color =
    risk >= 0.7 ? "bg-status-danger" : risk >= 0.4 ? "bg-status-caution" : risk >= 0.15 ? "bg-primary" : "bg-status-safe";
  return (
    <div className="flex gap-0.5" role="img" aria-label={`Risk ${risk.toFixed(2)} of 1.0`}>
      {Array.from({ length: segments }, (_, i) => (
        <span key={i} className={`w-1.5 h-2.5 ${i < filled ? color : "bg-surface-container-high"}`} />
      ))}
    </div>
  );
}

// ---------- busy / error states for panels ----------

export function Busy({ label = "COMPUTING" }: { label?: string }) {
  return (
    <div className="flex items-center gap-gutter-sm py-6 justify-center" role="status">
      <span className="w-2 h-2 bg-primary animate-pulse" />
      <span className="micro-label text-text-muted animate-pulse">{label}…</span>
    </div>
  );
}

export function Failure({ message, hint }: { message: string; hint?: string }) {
  return (
    <div className="border border-status-danger/40 bg-surface-container-lowest px-panel-pad-compact py-panel-pad-dense" role="alert">
      <div className="flex items-start gap-gutter-sm">
        <Icon name="emergency" className="text-status-danger text-[18px] mt-0.5" />
        <div className="min-w-0">
          <p className="font-telemetry-code text-telemetry-code text-status-danger">{message}</p>
          {hint && <p className="font-body-sm text-body-sm text-text-muted pt-0.5">{hint}</p>}
        </div>
      </div>
    </div>
  );
}
