/** Formatting helpers — all display-time, all UTC (TIMEZONE rule). */

export function utcStamp(date = new Date()): string {
  const d = date.toISOString();
  // "2026-09-05T06:30:00Z" -> "05 SEP 2026 06:30 UTC"
  const [, day, mon, rest] = /(\d{2})-(\d{2})-(\d{4})T(\d{2}:\d{2})/.exec(d) ?? [];
  if (!day) return d;
  const months = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
  const month = months[Number(mon) - 1] ?? mon;
  return `${day} ${month} ${rest.slice(0, 4)} ${rest.slice(5)} UTC`;
}

/** ISO string -> "05 SEP 06:30Z"; falls back to '—'. */
export function utcShort(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toISOString().slice(5, 16).replace("-", " ").replace("T", " ") + "Z";
}

export function pct(value: number | null | undefined, digits = 1): string {
  if (value == null) return "—";
  return `${(value * 100).toFixed(digits)}%`;
}

export function num(value: number | null | undefined, digits = 1): string {
  if (value == null || Number.isNaN(value)) return "—";
  return value.toLocaleString("en-US", { maximumFractionDigits: digits });
}

export function hours(h: number | null | undefined): string {
  if (h == null) return "—";
  if (h < 48) return `${h.toFixed(1)}h`;
  return `${(h / 24).toFixed(1)}d`;
}

export function coord(lat: number, lon: number): string {
  const latS = `${Math.abs(lat).toFixed(2)}°${lat < 0 ? "S" : "N"}`;
  const lonS = `${Math.abs(lon).toFixed(2)}°${lon < 0 ? "W" : "E"}`;
  return `${latS} ${lonS}`;
}

/** Bearing degrees -> 16-wind compass point. */
export function compass(deg: number | null): string {
  if (deg == null) return "—";
  const points = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE", "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"];
  return points[Math.round((((deg % 360) + 360) % 360) / 22.5) % 16];
}
