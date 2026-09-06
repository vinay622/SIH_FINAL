/**
 * Wire-shape mirrors of the POLARIS Pydantic response schemas.
 * All camelCase — toCamelCase() in caseConvert.ts normalizes at the boundary.
 * Verified against live responses of the seeded demo backend (2026-09-05).
 */

// ---------- shared ----------

export interface Domain {
  latMin: number;
  latMax: number;
  lonMin: number;
  lonMax: number;
  dlat: number;
  dlon: number;
  shape: number[];
}

export interface Bbox {
  latMin: number;
  latMax: number;
  lonMin: number;
  lonMax: number;
}

export type DataMode = "demo" | "real";

export type RowCounts = {
  seaIceObservations: number;
  seaIceExtentIndex: number;
  icebergObservations: number;
  weatherObservations: number;
  oceanObservations: number;
  forecasts: number;
  icebergTrajectories: number;
  riskGrid: number;
  routeResults: number;
  ingestionLog: number;
  modelRegistry: number;
};

/** Backend error envelope: {error: {code, message, status, hint?}} */
export interface ApiErrorEnvelope {
  error: { code: string; message: string; status?: number; hint?: string };
}

// ---------- /api/health ----------

export interface HealthComponent {
  name: string;
  status: string;
  detail: string;
  metadata?: Record<string, unknown>;
}

export interface HealthResponse {
  status: string;
  app: string;
  version: string;
  dataMode: DataMode;
  timestamp: string;
  uptimeSeconds: number;
  components: HealthComponent[];
  database: { rowCounts: RowCounts } & Record<string, string | number>;
}

// ---------- /api/dashboard/summary ----------

export interface HorizonForecast {
  status: string;
  algorithm: string;
  issuedAt: string;
  validAt: string;
  meanConcentration: number;
  iceCoveredFraction: number;
  validationRmse: number;
  skillVsPersistence: number;
}

export interface RiskHotspot {
  latitude: number;
  longitude: number;
  totalRisk: number;
  dominantComponent: string;
}

export interface IngestionRecord {
  source: string;
  dataset: string;
  status: string;
  records: number;
  startedAt: string;
  message: string | null;
}

export interface DashboardSummary {
  generatedAt: string;
  dataMode: DataMode;
  domain: Domain;
  seaIce: {
    observedAt: string;
    available: boolean;
    meanConcentration: number;
    iceCoveredFraction: number;
    iceEdgeLatitudeMean: number;
    oceanCells: number;
    hemisphericExtentMillionKm2: number;
    sources: string[];
  };
  forecast: {
    horizons: Record<string, HorizonForecast>;
    trainedModels: number[];
  };
  icebergs: {
    trackedCount: number;
    withTrajectories: number;
    totalAreaKm2: number;
    largest: { icebergId: string; areaKm2: number; latitude: number; longitude: number } | null;
    withDerivedDrift: number;
    issuedAt: string;
    sources: string[];
  };
  risk: {
    generatedAt: string;
    meanRisk: number;
    maxRisk: number;
    cellsNavigable: number;
    cellsBlocked: number;
    availableLayers: string[];
    missingLayers: string[];
    weights: RiskWeights;
    highestRiskAreas: RiskHotspot[];
  };
  routing: {
    available: boolean;
    graphNodes: number;
    graphEdges: number;
    stations: Record<string, { name: string; inDomain: boolean; nearestNavigableKm?: number }>;
    recentRoutes: number;
  };
  ingestion: { recent: IngestionRecord[]; lastSuccess: string };
  database: { rowCounts: RowCounts } & Record<string, string | number>;
  disclaimer: string;
}

export interface RiskWeights {
  seaIce: number;
  iceberg: number;
  weather: number;
  ocean: number;
  constraint: number;
}

// ---------- /api/risk/map ----------

export interface RiskMapResponse {
  summary: {
    generatedAt: string;
    validAt: string;
    horizonHours: number;
    grid: Domain;
    cellsTotal: number;
    cellsOcean: number;
    cellsNavigable: number;
    cellsBlocked: number;
    meanRisk: number;
    maxRisk: number;
    weights: RiskWeights;
    vessel: VesselProfile;
    availableLayers: string[];
    missingLayers: string[];
    nIcebergsConsidered: number;
    gridVersion: string;
    dataMode: DataMode;
  };
  cells: unknown[];
  totalRiskField: (number | null)[][];
  lats: number[];
  lons: number[];
  hotspots: RiskHotspot[];
}

// ---------- shared domain objects (used by several screens) ----------

export interface VesselProfile {
  name: string;
  iceClass: string;
  iceCapability: number;
  speedKnots: number;
  fuelConsumptionTpd: number;
  draftM: number;
  riskTolerance: number;
}

/** Lat/lon cell grid with per-cell numeric fields (sea-ice, forecast fields). */
export interface FieldGrid {
  latitude: number[];
  longitude: number[];
  fields: Record<string, (number | null)[][]>;
  generatedAt?: string;
  [key: string]: unknown;
}

/** Risk bands used for heat colors — matches the engine's tier thresholds. */
export function riskBand(risk: number): "blocked" | "high" | "moderate" | "low" | "minimal" {
  if (risk >= 0.9) return "blocked";
  if (risk >= 0.7) return "high";
  if (risk >= 0.4) return "moderate";
  if (risk >= 0.15) return "low";
  return "minimal";
}
