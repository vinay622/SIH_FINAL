/**
 * snake_case (wire) ⇄ camelCase (app) conversion.
 *
 * The POLARIS backend serializes with Pydantic's default snake_case. All
 * conversion happens here — components only ever see camelCase.
 *
 * ONE EXCEPTION, by design: GeoJSON. `geometry: {type, coordinates}` and
 * FeatureCollection members use spec-mandated lowercase keys that Leaflet
 * consumes directly, so `geometry` subtrees pass through untouched.
 */

const SNAKE = /_([a-z0-9])/g;

export function snakeToCamelKey(key: string): string {
  return key.replace(SNAKE, (_, c: string) => c.toUpperCase());
}

/** Keys whose subtrees are left exactly as received (GeoJSON + foreign formats). */
const PASS_THROUGH_KEYS = new Set(["geometry", "coordinates", "properties", "features"]);

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v) && !(v instanceof Date);
}

export function toCamelCase<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((v) => toCamelCase(v)) as unknown as T;
  }
  if (!isPlainObject(value)) {
    return value;
  }
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value)) {
    if (PASS_THROUGH_KEYS.has(k)) {
      out[snakeToCamelKey(k)] = v;
    } else {
      out[snakeToCamelKey(k)] = toCamelCase(v);
    }
  }
  return out as T;
}

export function toSnakeCase<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((v) => toSnakeCase(v)) as unknown as T;
  }
  if (!isPlainObject(value)) {
    return value;
  }
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value)) {
    const sk = k.replace(/[A-Z0-9]/g, (c, i) => (i > 0 ? "_" + c.toLowerCase() : c.toLowerCase()));
    out[sk] = toSnakeCase(v);
  }
  return out as T;
}
