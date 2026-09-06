/**
 * Material Symbols Outlined icon — the icon system used by every Stitch screen.
 * Served from the self-hosted material-symbols npm package (no CDN dependency
 * in production; PLAN.md §10 forbids external runtime deps on the vessel).
 */

export type IconName =
  | "grid_view" | "explore" | "layers" | "radar" | "alt_route" | "warning"
  | "air" | "notifications_active" | "description" | "ac_unit" | "visibility"
  | "satellite_alt" | "security" | "person" | "trending_up" | "trending_down"
  | "arrow_forward" | "arrow_outward" | "check_circle" | "schedule" | "bolt"
  | "public" | "waves" | "storm" | "close" | "refresh" | "download"
  | "play_arrow" | "pause" | "insights" | "monitoring" | "science"
  | "emergency" | "location_on" | "speed" | "route" | "thermostat"
  | "water_drop" | "compress" | "expand_content" | "data_usage"
  | "psychology" | "memory" | "database" | "sync" | "history" | "flag"
  | "south" | "north_east" | "fullscreen" | "filter_alt" | "settings"
  | "analytics" | "terrain" | "sailing" | "anchor" | "calendar_month"
  | "trending_flat" | "cancel"
  | (string & {});

export function Icon({ name, className }: { name: IconName; className?: string }) {
  return (
    <span aria-hidden="true" className={`material-symbols-outlined ${className ?? ""}`}>
      {name}
    </span>
  );
}
