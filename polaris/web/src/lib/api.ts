/**
 * Typed POLARIS API client — one function per endpoint (20 routes + health/live).
 *
 * Query keys and caching policy (PLAN.md §5.4):
 *   ['health']           10s    — HUD status pill
 *   ['dashboard']        60s   — server computes summary; expensive (2.5s warm)
 *   ['risk', horizon, stride] 5min
 *   everything else      60s stale-while-revalidate
 *
 * Latency notes (measured, warm demo backend): field endpoints 0.3–0.5s,
 * dashboard/summary ~2.5s (60s server cache), navigation/stations ~2.8s,
 * POST /route/optimize 3–8s. Panels load in parallel; busy states required.
 */

import { request } from "./http";
import type {
  Bbox,
  DashboardSummary,
  Domain,
  HealthResponse,
  HorizonForecast,
  RiskMapResponse,
  VesselProfile,
} from "./types";
import type { FeatureCollection, Geometry } from "geojson";

// ---------- shared response fragments ----------

export interface ProvenanceInfo {
  dataMode: string;
  sources: string[];
  disclaimer: string;
  observedAt: string;
  generatedAt: string | null;
}

export interface ScalarField {
  lats: number[];
  lons: number[];
  values: (number | null)[][];
}

// ---------- system & health ----------

export const getHealth = () => request<HealthResponse>("/api/health");
export const getHealthLive = () =>
  request<{ status: string; uptimeSeconds: number }>("/api/health/live");
export const getHealthReady = () =>
  request<{ status: string }>("/api/health/ready");
export const getSystem = () =>
  request<Record<string, unknown>>("/api/system");

// ---------- dashboard ----------

export const getDashboardSummary = () =>
  request<DashboardSummary>("/api/dashboard/summary");

export interface ModelArtifact {
  algorithm: string;
  horizonHours: number;
  version: string;
  trainedAt: string;
  nTrainSamples: number;
  nValSamples: number;
  nFeatures: number;
  featureNames: string[];
  metrics: HorizonForecast & Record<string, unknown>;
}

export const getDashboardModels = () =>
  request<{ artifacts: Record<string, ModelArtifact> }>("/api/dashboard/models");

export interface IngestionRun {
  id: number;
  source: string;
  dataset: string;
  dataMode: string;
  status: string;
  startedAt: string;
  finishedAt: string;
  recordsIngested: number;
  recordsRejected: number;
  message: string | null;
  details: Record<string, unknown>;
}

export const getDashboardIngestion = () =>
  request<{ count: number; runs: IngestionRun[] }>("/api/dashboard/ingestion");

// ---------- sea ice ----------

export interface SeaIceStatistics {
  meanConcentration: number;
  maxConcentration: number;
  iceCoveredFraction: number;
  oceanCells: number;
  iceEdgeLatitudeMean: number | null;
}

export interface SeaIceCurrentResponse {
  observedAt: string;
  grid: Domain;
  statistics: SeaIceStatistics;
  cells: unknown[];
  field: ScalarField;
  hemisphericExtentMillionKm2: number | null;
  provenance: ProvenanceInfo;
}

export interface ValidationEdgeMetrics {
  accuracy: number;
  precision: number;
  recall: number;
  f1: number;
  iceFractionTrue: number;
}

export interface ValidationMetrics {
  n: number;
  mae: number;
  rmse: number;
  r2: number;
  bias: number;
  edge: ValidationEdgeMetrics;
  persistenceBaseline: { n: number; mae: number; rmse: number; r2: number; bias: number };
  skillVsPersistence: number;
  selectedCandidate: string;
  candidates: Record<string, { rmse: number; mae: number; skillVsPersistence: number }>;
}

export interface SeaIceForecastResponse {
  issuedAt: string;
  validAt: string;
  forecastHours: number;
  modelName: string;
  modelVersion: string;
  algorithm: string;
  grid: Domain;
  statistics: SeaIceStatistics;
  cells: unknown[];
  field: ScalarField;
  uncertainty: ScalarField;
  validationMetrics: ValidationMetrics;
  provenance: ProvenanceInfo;
}

export interface ExtentPoint {
  observedAt: string;
  extentMillionKm2: number;
  areaMillionKm2: number;
}

export const getSeaIceCurrent = (params?: { bbox?: Bbox; stride?: number }) =>
  request<SeaIceCurrentResponse>("/api/sea-ice/current", {
    query: {
      bbox: params?.bbox
        ? [params.bbox.latMin, params.bbox.latMax, params.bbox.lonMin, params.bbox.lonMax].join(",")
        : undefined,
      stride: params?.stride,
    },
  });

export const getSeaIceForecast = (params: { horizon?: number } = {}) =>
  request<SeaIceForecastResponse>("/api/sea-ice/forecast", {
    query: { horizon: params.horizon ?? 72 },
  });

export const getSeaIceExtent = (params: { months?: number } = {}) =>
  request<{ hemisphere: string; series: ExtentPoint[]; provenance: ProvenanceInfo }>(
    "/api/sea-ice/extent",
    { query: { months: params.months ?? 120 } },
  );

// ---------- icebergs ----------

export interface IcebergOut {
  icebergId: string;
  observedAt: string;
  latitude: number;
  longitude: number;
  lengthNm: number;
  widthNm: number;
  areaKm2: number;
  driftSpeedM: number;
  driftBearingDeg: number;
  nObservations: number;
  inDomain: boolean;
  source: string;
  dataMode: string;
}

export const getIcebergs = (params?: { bbox?: Bbox }) =>
  request<{ count: number; icebergs: IcebergOut[]; provenance: ProvenanceInfo }>(
    "/api/icebergs",
    {
      query: {
        bbox: params?.bbox
          ? [params.bbox.latMin, params.bbox.latMax, params.bbox.lonMin, params.bbox.lonMax].join(",")
          : undefined,
      },
    },
  );

export interface TrajectoryPoint {
  validAt: string;
  hoursAhead: number;
  latitude: number;
  longitude: number;
}

export interface IcebergTrajectory {
  icebergId: string;
  ensembleSize: number;
  driftSpeedM: number;
  points: TrajectoryPoint[];
  provenance: ProvenanceInfo;
}

export const getIcebergTrajectories = () =>
  request<{ trajectories: IcebergTrajectory[] }>("/api/icebergs/trajectories");

export const getIcebergTrajectory = (icebergId: string) =>
  request<IcebergTrajectory>(`/api/icebergs/${encodeURIComponent(icebergId)}/trajectory`);

// ---------- weather & ocean ----------

export interface StationConditions {
  station: string;
  displayName: string;
  operator: string | null;
  region: string | null;
  latitude: number;
  longitude: number;
  observedAt: string;
  airTemperatureC: number;
  windSpeedM: number;
  windDirectionDeg: number;
  beaufortForce: number;
  meanSeaLevelPressureHpa: number;
  relativeHumidityPct: number;
  cloudCoverPct: number;
  significantWaveHeightM: number | null;
  wavePeriodS: number | null;
  oceanCurrentSpeedM: number;
  oceanCurrentDirectionDeg: number;
  seaSurfaceTemperatureC: number;
  freezingSprayRisk: string;
  source: string;
  marineSource: string;
  forecast: {
    validAt: string;
    airTemperatureC: number;
    windSpeedM: number;
    windDirectionDeg: number;
    meanSeaLevelPressureHpa: number;
  }[];
}

export interface LiveConditionsResponse {
  generatedAt: string;
  dataMode: string;
  layers: Record<string, { observedAt: string; ageHours: number }>;
  provenance: ProvenanceInfo;
}

export const getWeatherCurrent = () => request<LiveConditionsResponse>("/api/weather/current");
export const getWeatherStations = (params: { forecastHours?: number } = {}) =>
  request<{ count: number; forecastHours: number; stations: StationConditions[]; provenance: ProvenanceInfo }>(
    "/api/weather/stations",
    { query: { forecast_hours: params.forecastHours ?? 48 } },
  );
export const getWeatherPoint = (latitude: number, longitude: number) =>
  request<StationConditions>("/api/weather/point", {
    query: { latitude, longitude },
  });

// ---------- risk ----------

export const getRiskMap = (params: { horizon?: number; stride?: number; bbox?: Bbox } = {}) =>
  request<RiskMapResponse>("/api/risk/map", {
    query: {
      horizon: params.horizon ?? 72,
      stride: params.stride ?? 4,
      bbox: params.bbox
        ? [params.bbox.latMin, params.bbox.latMax, params.bbox.lonMin, params.bbox.lonMax].join(",")
        : undefined,
    },
  });

export interface PointRiskResponse {
  seaIceRisk: number;
  icebergRisk: number;
  weatherRisk: number;
  oceanRisk: number;
  constraintRisk: number;
  latitude: number;
  longitude: number;
  totalRisk: number;
  navigable: boolean;
  generatedAt: string;
  validAt: string;
  horizonHours: number;
  provenance: ProvenanceInfo;
}

export const getRiskPoint = (latitude: number, longitude: number, params: { horizon?: number } = {}) =>
  request<PointRiskResponse>("/api/risk/point", {
    query: { latitude, longitude, horizon: params.horizon ?? 72 },
  });

// ---------- navigation & routing ----------

export interface StationOut {
  key: string;
  name: string;
  operator: string;
  region: string;
  latitude: number;
  longitude: number;
  inDomain: boolean;
  nearestNavigableKm: number | null;
}

export const getNavigationStations = () =>
  request<{ stations: StationOut[]; domain: import("./types").Domain }>("/api/navigation/stations");

export const getNavigationLandmask = () =>
  request<FeatureCollection>("/api/navigation/landmask");

/** Stored route results — summary list or one by request id. */
export const getNavigationRoutes = () =>
  request<{ count: number; routes: Record<string, unknown>[] }>("/api/navigation/routes");

export const getNavigationRoute = (requestId: string) =>
  request<Record<string, unknown>>(`/api/navigation/routes/${encodeURIComponent(requestId)}`);

export interface NamedLocation {
  latitude?: number;
  longitude?: number;
  station?: string;
  name?: string;
}

export interface RouteOptimizeRequest {
  start: NamedLocation;
  destination: NamedLocation;
  vessel?: Partial<VesselProfile>;
  preferences?: {
    profiles?: string[];
    forecastHours?: number;
    algorithm?: "astar" | "dijkstra";
    distanceWeight?: number;
    riskWeight?: number;
    fuelWeight?: number;
    riskWeights?: Partial<{
      seaIce: number;
      iceberg: number;
      weather: number;
      ocean: number;
      constraint: number;
    }>;
    includeIcebergAnalysis?: boolean;
    simplifyGeometry?: boolean;
  };
  persist?: boolean;
}

export interface RouteOut {
  profile: string;
  status: string;
  algorithm: string;
  distanceKm: number;
  durationHours: number;
  estimatedFuelTonnes: number;
  meanRisk: number;
  maxRisk: number;
  maxSeaIceConcentration: number;
  nWaypoints: number;
  waypoints: { latitude: number; longitude: number }[];
  geometry: Geometry;
  costWeights: Record<string, number>;
  startSnapKm: number;
  endSnapKm: number;
  riskAssessment?: Record<string, unknown>;
  notes?: string[];
}

export interface RouteOptimizeResponse {
  requestId: string;
  computedAt: string;
  start: NamedLocation;
  destination: NamedLocation;
  vessel: VesselProfile;
  graph: Record<string, unknown>;
  fallbackGraph: Record<string, unknown> | null;
  riskGrid: Record<string, unknown>;
  routes: Record<string, RouteOut>;
  recommendedProfile: string | null;
  comparison?: Record<string, unknown>;
  errors?: Record<string, unknown>;
  persistedRouteIds?: number[];
  provenance: ProvenanceInfo;
}

export const postRouteOptimize = (body: RouteOptimizeRequest) =>
  request<RouteOptimizeResponse>("/api/route/optimize", { method: "POST", body });
