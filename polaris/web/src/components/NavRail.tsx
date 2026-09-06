/** Primary navigation, presented as a temporary desktop drawer. */

import { useEffect } from "react";
import { NavLink } from "react-router-dom";
import { Icon, type IconName } from "./Icon";
import { useAlerts } from "../hooks/useAlerts";

interface NavItem {
  to: string;
  label: string;
  icon: IconName;
  badge?: string;
}

function NavButton({ item, onNavigate }: { item: NavItem; onNavigate: () => void }) {
  return (
    <NavLink
      to={item.to}
      end={item.to === "/"}
      title={item.label}
      onClick={onNavigate}
      className={({ isActive }) =>
        `group relative flex h-11 items-center gap-gutter-md border-l-2 px-panel-pad-default transition-colors ${
          isActive
            ? "bg-primary-container text-on-primary font-bold border-primary"
            : "border-transparent text-on-surface-variant hover:bg-surface-container-high hover:text-text-primary"
        }`
      }
    >
      <Icon name={item.icon} className="text-[18px] shrink-0" />
      <span className="font-headline-sm text-headline-sm truncate">{item.label}</span>
      {item.badge && <span className="ml-auto px-1.5 py-0.5 bg-status-danger text-on-primary font-micro-label text-[9px] font-bold rounded">{item.badge}</span>}
    </NavLink>
  );
}

export function NavRail({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { activeCount } = useAlerts();

  useEffect(() => {
    if (!open) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [open, onClose]);

  const navItems: NavItem[] = [
    { to: "/", label: "DASHBOARD", icon: "grid_view" },
    { to: "/planner", label: "MISSION PLANNER", icon: "explore" },
    { to: "/sea-ice", label: "SEA ICE FORECAST", icon: "layers" },
    { to: "/icebergs", label: "ICEBERG TRACKER", icon: "radar" },
    { to: "/route", label: "ROUTE OPTIMIZER", icon: "alt_route" },
    { to: "/risk", label: "RISK ANALYSIS", icon: "warning" },
    { to: "/weather", label: "WEATHER & OCEAN", icon: "air" },
    { to: "/alerts", label: "ALERTS", icon: "notifications_active", badge: activeCount > 0 ? String(activeCount) : undefined },
    { to: "/reports", label: "REPORTS", icon: "description" },
  ];

  return (
    <>
      {open && <button type="button" aria-label="Close navigation" onClick={onClose} className="hidden md:block fixed inset-0 z-40 bg-surface-void/70 backdrop-blur-[1px]" />}
      <aside id="primary-navigation" aria-label="Primary navigation" aria-hidden={!open} className={`hidden md:flex fixed left-0 top-0 bottom-0 z-[60] w-72 flex-col border-r border-border-subtle bg-surface-container-low shadow-2xl transition-transform duration-200 ${open ? "translate-x-0" : "-translate-x-full"}`}>
        <div className="h-16 flex items-center justify-between px-panel-pad-default border-b border-border-subtle">
          <div><div className="micro-label text-text-muted">NAVIGATION</div><div className="font-headline-sm text-headline-sm text-text-primary pt-0.5">MISSION CONTROL</div></div>
          <button type="button" aria-label="Close navigation" onClick={onClose} className="w-9 h-9 grid place-items-center text-text-secondary hover:text-primary hover:bg-surface-container-high transition-colors"><Icon name="close" className="text-[20px]" /></button>
        </div>
        <nav aria-label="Primary" className="flex flex-col py-gutter-sm overflow-y-auto">
          {navItems.map((item) => <NavButton key={item.to} item={item} onNavigate={onClose} />)}
        </nav>
        <div className="mt-auto border-t border-border-subtle p-panel-pad-default"><div className="micro-label text-text-muted">SAT LINK</div><div className="flex items-center gap-gutter-sm pt-1"><span className="w-4/5 h-1 bg-primary/70" /><span className="w-1/5 h-1 bg-surface-container-high" /></div><div className="font-telemetry-code text-telemetry-code text-text-secondary pt-1">POLAR ORBITER-7</div></div>
      </aside>

      <nav aria-label="Primary" className="md:hidden fixed bottom-0 left-0 right-0 h-16 z-40 bg-surface-raised border-t border-border-subtle flex items-stretch">
        {navItems.map((item) => (
          <NavLink key={item.to} to={item.to} end={item.to === "/"} title={item.label} className={({ isActive }) => `relative flex-1 flex flex-col items-center justify-center gap-0.5 ${isActive ? "text-primary" : "text-on-surface-variant"}`}>
            {({ isActive }) => <><Icon name={item.icon} className={`text-[20px] ${isActive ? "font-bold" : ""}`} /><span className="micro-label text-[8px] truncate max-w-full px-0.5">{item.label.split(" ")[0]}</span>{item.badge && <span className="absolute top-2 right-1/2 translate-x-3 px-1 py-0.5 bg-status-danger text-on-primary font-micro-label text-[8px] font-bold">{item.badge}</span>}</>}
          </NavLink>
        ))}
      </nav>
    </>
  );
}
