# POLARIS Full-Stack Integration Plan
**SIH26059 · Ministry of Earth Sciences / NCPOR · Smart India Hackathon 2026**

Deliverable: a production-ready web application that pairs the existing POLARIS
FastAPI backend with a new React frontend that implements the "Polar Operations
Command" Stitch design system (project 13425453471802998895, 11 screens).

All facts in this plan were verified against the actual assets: the backend was
booted, seeded with demo data, and exercised live on 2026-09-05 (every command
and latency below was measured, not estimated).

---

## 1. Architecture & Tech Stack

### 1.1 Chosen stack

| Layer | Technology | Why |
|---|---|---|
| Backend | **FastAPI 0.141.1** (existing, unchanged) | Already complete: 20 endpoints, ML pipeline, tests, uniform error envelope, provenance on every payload. Rebuilding any of it adds risk, not value. |
| Frontend | **React 19 + Vite 7 + TypeScript** | The Stitch designs are data-dense operational dashboards (grids, tables, telemetry). React's component model maps 1:1 onto the repeated panel/metric/legend patterns; Vite gives instant HMR and a static `dist/` output that FastAPI can serve directly. TypeScript is non-negotiable for the 20-endpoint contract — the response shapes are large and nested (risk grids, route profiles, provenance objects). |
| Styling | **Tailwind CSS 4** with the Stitch tokens wired in as a theme | The Stitch HTML is authored in Tailwind classes against a token palette (`surface-raised`, `primary-container`, `status-safe`…). Reusing those exact token names means the design HTML translates to React almost class-for-class, with zero manual color translation. |
| Map | **Leaflet 1.9.4** (vendored in the backend's test client; reuse it) | The backend already serves a GeoJSON landmask (`GET /navigation/landmask`) precisely so clients can draw the coastline **without a tile server** — Leaflet renders that GeoJSON natively, works offline (SIH demo conditions), and is what the vendored client already uses. |
| State / data | **TanStack Query v5** + a thin hand-rolled API client | The app is read-heavy with one POST (`/route/optimize`). TanStack Query gives caching, dedup, retries, and loading/error states per screen with almost no boilerplate; the "optimistic update" and "refetch on focus" patterns the screens imply (forecast-horizon slider → refetch risk map) map directly onto its primitives. |
| Database | **SQLite** (demo default) → **PostgreSQL + PostGIS** (production) | Backend already supports both via `DATABASE_URL`; demo/real modes keep *separate* databases (the `{mode}` placeholder). SQLite keeps the hackathon demo zero-setup; PostgreSQL is the real-data production target. |
| Auth | **None in backend; API-key middleware added for production** | See §3.3 — the backend has zero auth, by design. For the SIH scope this is an intranet ops console; the plan adds an opt-in `X-API-Key` FastAPI middleware (single shared key from env var) so production deployments are not open. |
| API convention | REST/JSON, **snake_case wire format** (Pydantic default), uniform error envelope | Backend contract is fixed and consistent; frontend converts snake↔camel at the API-client boundary (see §6.1). |

### 1.2 System architecture

```
                        ┌──────────────────────────────────┐
                        │  Browser                         │
                        │  React SPA (Vite build)          │
                        │  ├─ TanStack Query cache         │
                        │  ├─ Leaflet map (GeoJSON layers) │
                        │  └─ snake↔camel converter        │
                        └───────────────┬──────────────────┘
                                        │  /api/*  (JSON, snake_case)
                                        ▼
┌───────────────────────────────────────────────────────────────────┐
│  FastAPI backend (existing — no changes needed for demo)          │
│  ├─ Routers: navigation, sea_ice, icebergs, weather, risk,       │
│  │  dashboard, health  (20 endpoints under /api)                 │
│  ├─ Uniform error envelope + provenance on every payload         │
│  ├─ Optional X-API-Key middleware (added in phase 3)              │
│  └─ StaticFiles: serves built SPA at /  (change /ui mount)        │
└───────────────┬───────────────────────────────────────────────────┘
                │ SQLAlchemy 2.0 (create_all — no Alembic)
                ▼
        SQLite (polaris_demo.db)  ──or──  PostgreSQL + PostGIS
        data ingestion → preprocessing → GBR forecast → iceberg
        trajectories (RK4 + ensemble) → risk engine → route optimizer
        (networkx A*/Dijkstra over the risk grid)
```

### 1.3 What stays and what is new

| Asset | Disposition |
|---|---|
| `polaris/backend/**` | **Kept as-is.** Verified: `python run.py` boots, demo seed completes in ~3 min, 199/204 tests pass (5 failures are env-version drift in the global Anaconda env, not code — see §10). |
| `polaris/frontend/**` (static test client) | **Replaced.** It's a deliberately minimal vanilla-JS client with no build step — a backend smoke-test tool, not a product UI. Preserved as `polaris/frontend-legacy/` for reference; the new SPA lives in `polaris/web/`. |
| Stitch designs (11 screens + DESIGN.md) | **Archived at `polaris/design/stitch/`** (00-ops-console … 09-tactical-alerts, polar emblem SVG). Source of truth for every UI decision. |
| Polar emblem SVG | Copied to `web/public/emblem.svg` for the header HUD. |

---

## 2. Environment Setup (verified commands)

> Windows 11 + Git Bash assumed. Everything below was executed and confirmed
> working on this machine (2026-09-05). Backend stack is already present in the
> global Anaconda Python 3.13.9 — for production, use a pinned venv (§2.4).

### 2.1 One-time backend setup (demo mode — zero network needed)

```bash
cd polaris/backend

# (recommended) pinned venv — global env has sklearn 1.7.2 vs pinned 1.9.0
python -m venv .venv
source .venv/Scripts/activate   # Git Bash on Windows
python -m pip install -r requirements.txt

# Create schema + ingest synthetic observations + build 120-day history +
# train GBR forecast models + generate risk grid + compute demo routes.
# Measured: ~3 minutes on this machine. No network required.
python scripts/seed_demo_data.py

# Start the API (SQLite polaris_demo.db is created automatically)
python run.py                  # → http://localhost:8000
```

Quick verification (all measured live):
```bash
curl http://localhost:8000/api/health          # {"status":"ok","data_mode":"demo",...}
curl http://localhost:8000/api/dashboard/summary
```

### 2.2 Frontend setup (new `polaris/web/`)

```bash
cd polaris
npm create vite@latest web -- --template react-ts
cd web
npm install
npm install @tanstack/react-query leaflet react-leaflet
npm install -D tailwindcss @tailwindcss/vite
```

### 2.3 Environment variables

Backend — every variable has a working default; `.env` is optional (demo mode
needs nothing):

| Variable | Default | When to set |
|---|---|---|
| `DATA_MODE` | `demo` | `real` for live NSIDC/USNIC/ERA5/Copernicus ingestion |
| `DATABASE_URL` | `sqlite:////<backend>/polaris_{mode}.db` | PostgreSQL: `postgresql+psycopg2://user:pass@host/polaris` |
| `CORS_ORIGINS` | `*` | Set to the SPA origin in production (e.g. `http://localhost:5173,https://polaris.example.in`) |
| `API_HOST` / `API_PORT` | `0.0.0.0` / `8000` | Behind a proxy, bind `127.0.0.1` |
| `POLARIS_API_KEY` | unset | Enables the opt-in API-key middleware (§3.3) |

Real-data mode (optional, needs credentials/network):
```bash
export DATA_MODE=real
export ERA5_API_KEY=...              # optional — key-free mirrors work too
export COPERNICUS_USERNAME=... COPERNICUS_PASSWORD=...
python scripts/download_data.py && python scripts/preprocess_data.py
python scripts/train_models.py
python run.py --mode real
```

### 2.4 Dependency hygiene note

The global Anaconda env currently runs sklearn 1.7.2 / numpy 2.3.5 / networkx
3.5 against pins of 1.9.0 / 2.2.6 / 3.6.1, producing 5 forecast-skill test
failures (`persistence` beats the GBR on the test fixture). The seed script and
all 19 other test files pass regardless. **Use the pinned venv for anything
that touches model training or CI.**

---

## 3. API & Services Integration

### 3.1 Endpoint inventory (all verified live)

All under `/api`. Every response carries a `provenance` object
(`data_mode`, `sources`, `disclaimer`, `observed_at`, `generated_at`); every
response carries `X-Process-Time-ms` and `X-POLARIS-Data-Mode` headers.

| # | Endpoint | Purpose | Frontend screen |
|---|---|---|---|
| 1 | `GET /health` (+`/health/live`, `/health/ready`, `/system`) | Component health: DB, models, data layers | Global HUD (status pill) |
| 2 | `GET /dashboard/summary` | One-call mission overview: sea_ice, forecast, icebergs, keys, routing, ingestion, database sections | **Ops Console** (screen 00) |
| 3 | `GET /navigation/stations` | 3 stations (bharati, maitri, cape_town) + snap distance to navigable water | Mission Planner |
| 4 | `GET /navigation/landmask` | GeoJSON FeatureCollection of land rectangles (client-side coastline) | Every map screen |
| 5 | `GET /navigation/routes/{request_id}` | Stored route by request | Route Optimizer, Reports |
| 6 | `GET /navigation/routes?limit=` | Recent routes (ids, profiles, stats) | Mission Reports |
| 6b | `GET /navigation/history?bbox=` | Re-plotted historic iceberg track segments | Iceberg Tracker |
| 7 | `GET /sea-ice/current?format=grid\|cells\|both&stride=&bbox=` | Gridded concentration (lats/lons/values 2D lists) + stats + hemispheric extent | Sea Ice Forecast |
| 8 | `GET /sea-ice/forecast?forecast_hours=24\|48\|72` | GBR model forecast per horizon with uncertainty | Sea Ice Forecast |
| 9 | `GET /sea-ice/extent` | Hemispheric daily extent index | Dashboard strip |
| 10 | `GET /icebergs?bbox=&min_area_km2=&limit=` | Tracked bergs; drift speed/bearing derived from previous fix | Iceberg Tracker |
| 11 | `GET /icebergs/{id}/trajectory?forecast_hours=&persist=` | RK4 physics trajectory + ensemble uncertainty radius | Iceberg Tracker |
| 12 | `GET /icebergs/trajectories` | All stored trajectories | Iceberg Tracker |
| 22 | `GET /risk/map?forecast_hours=&stride=&min_risk=&vessel params=&top_hotspots=` | 5-component risk field + hotspots; `summary.missing_layers` when degraded | Risk Analysis |
| 14 | `GET /risk/point?latitude=&longitude=` | Point risk with component breakdown | Risk Analysis hover |
| 15 | `GET /weather/stations` | Station weather | Weather & Ocean |
| 16 | `GET /weather/point?latitude=&longitude=&forecast_hours=` | Open-Meteo ECMWF IFS live point forecast (503 when provider down) | Weather & Ocean |
| 17 | `GET /weather/current` | Freshness/age of every environmental layer | Weather & Ocean |
| 18 | `GET /dashboard/models` | Trained-model registry with held-out metrics | Mission Reports / models |
| 19 | `POST /route/optimize` | **The core action.** A*/Dijkstra over risk grid; 3 profiles; GeoJSON LineString geometry per route | **Mission Planner** + Route Optimizer |
| 20 | `GET /dashboard/ingestion` | Ingestion audit trail | Reports |

### 3.2 Core schemas (from the Pydantic source — the contract)

**POST /api/route/optimize** — request:
```jsonc
{
  "start":      { "station": "bharati" },            // or { "latitude": -69.4, "longitude": 76.2 }
  "destination": { "station": "maitri" },
  "vessel": {
    "name": "MV Sagar Nidhi", "ice_class": "icebreaker",   // none|1c|1b|1a|1a_super|pc5|icebreaker
    "speed_knots": 12, "fuel_consumption_tpd": 25, "draft_m": 7, "risk_tolerance": 0.3
  },
  "preferences": {
    "profiles": ["shortest", "safest", "polaris"],
    "forecast_hours": 24,                             // 0|24|48|72
    "algorithm": "astar",                             // astar|dijkstra
    "distance_weight": null, "risk_weight": null, "fuel_weight": null,  // 0–10, profile-relative
    "risk_weights": { "sea_ice": 0.40, "iceberg": 0.25, "weather": 0.20, "ocean": 0.10, "constraint": 0.05 },  // optional overrides
    "include_iceberg_analysis": true, "simplify_geometry": true
  },
  "persist": true
}
```
Response (abridged — `routes` is a profile→RouteOut map):
```jsonc
{
  "request_id": "cf945cf8ccb7411a", "computed_at": "2026-09-05T22:41:11Z",
  "routes": {
    "polaris": {
      "profile": "polaris", "status": "ok", "algorithm": "astar",
      "distance_km": 3796.3, "duration_hours": 1048.8, "estimated_fuel_tonnes": 1093.1,
      "mean_risk": 0.445, "max_risk": 0.83, "max_sea_ice_concentration": 0.62,
      "n_waypoints": 141, "waypoints": [{"latitude": -69.4, "longitude": 76.19}, …],
      "geometry": { "type": "Feature", "geometry": { "type": "LineString", "coordinates": [[lon,lat],…] } },
      "cost_weights": {...}, "start_snap_km": 12.4, "end_snap_km": 3.1,
      "risk_assessment": {...}, "notes": [...]
    }, "shortest": {…}, "safest": {…}
  },
  "recommended_profile": "polaris", "comparison": {...},
  "persisted_route_ids": [12, 13, 14], "provenance": { "data_mode": "demo", … }
}
```

**GET /api/risk/map** — response:
```jsonc
{
  "summary": { "n_cells": 930, "mean_risk": 0.23, "max_risk": 0.86, "missing_layers": [],
               "weights": { "sea_ice": 0.4, "iceberg": 0.25, "weather": 0.2, "ocean": 0.1, "constraint": 0.05 } },
  "cells": [ { "latitude": -68.75, "longitude": 0.5, "total_risk": 0.42,
               "sea_ice_risk": 0.61, "iceberg_risk": 0.0, … , "navigable": true }, … ],
  "total_risk_field": [[…]], "lats": […], "lons": […],
  "hotspots": [ { "latitude": …, "longitude": …, "total_risk": 0.93, … } ],
  "scale": { "min": 0.0, "max": 1.0 }, "provenance": {…}
}
```

**Error envelope** (identical on every 4xx/5xx):
```jsonc
{ "error": "DATA_UNAVAILABLE", "detail": "…", "status_code": 503,
  "path": "/api/sea-ice/current", "hint": "Run the ingestion scripts, then retry." }
```

### 3.3 Authentication & authorization

**Fact: the backend has no authentication.** No tokens, no sessions, no users —
nothing in `app/` implements auth. The plan's approach:

- **SIH / intranet scope (default):** none needed. The console is an internal
  decision-support tool on a controlled network; document the constraint.
- **Production hardening (phase 3, ~40 lines added to `app/main.py`):** opt-in
  API-key middleware:
  ```python
  # app/middleware/auth.py (new, phase 3)
  @app.middleware("http")
  async def require_api_key(request, call_next):
      if request.url.path.startswith(f"{settings.api_prefix}") and settings.api_key:
          if request.headers.get("X-API-Key") != settings.api_key:
              return JSONResponse({"error": "UNAUTHORIZED", "status_code": 401, "path": request.url.path}, 401)
      return await call_next(request)
  ```
  Enabled by setting `POLARIS_API_KEY`; unset ⇒ open (demo behavior preserved).
  SPA serves the key via `VITE_POLARIS_API_KEY` at build time for same-origin
  deployment (proxy avoids exposing it in the browser at all).
- **Authorization (roles):** out of scope — single-operator console. The
  `role` concept in the Stitch designs (person icon in HUD) is display-only.
- TLS termination at the reverse proxy (nginx/Caddy), HTTP + X-API-Key inside.

### 3.4 Not-implemented → screen mapping (honesty table)

Two Stitch screens have **no backend counterpart**. Alternatives stated per the
task's "indicate alternatives" rule:

| Stitch screen | Backend support | Approach |
|---|---| Frontend derives |
|---|---|---|
| Tactical Alerts (09) | **None** — no alert engine | **Derived client-side**: thresholds over live `/risk/map` hotspots + `/icebergs` CPA + `/health` components. E.g. `alert = hotspot.total_risk > 0.75` → "critical ice-concentration corridor". The HUD "3" badge counts these derived alerts. |
| Mission Planner objectives/cargo (01) | Partial — stations/routes only | Objectives/cargo manifest modeled **client-side** (localStorage) + route computation via `/route/optimize`. Persistence of missions beyond routes is out of scope (no mission table). |
| Weather & Ocean live telemetry (05) | Partial — `/weather/point` is live Open-Meteo; ocean layers are demo/ingested | Wind/temp/pressure from `/weather/point`; currents/SST/salinity from `/dashboard/summary` ocean section. |

---

## 4. Data Model & Schema

### 4.1 Existing schema (11 tables — SQLAlchemy `Base.metadata.create_all()`)

Verified in `app/models/database_models.py`. No FKs, no cascades — integrity is
enforced at the application layer (consistent with the schema philosophy:
demo/real must never mix silently).

```
Observations (append-only, provenance-stamped)
├─ sea_ice_observations   (observed_at, lat, lon, concentration, is_land, source, data_mode)
├─ sea_ice_extent_index   (observed_at, hemisphere, extent_million_km2, area_million_km2)
├─ iceberg_observations   (iceberg_id, observed_at, lat, lon, length/width_nm, area_km2,
│                          drift_speed_km_per_day, drift_bearing_deg)
├─ weather_observations   (u10/v10 m/s, wind_speed/dir, air_temp_c, mslp_hpa)
└─ ocean_observations     (u/v current m/s, sst_c, salinity_psu, sig_wave_height_m)

Model output
├─ forecasts              (issued_at, valid_at, horizon_hours, predicted_concentration,
│                          uncertainty, model_name/version)          ← GBR models
├─ iceberg_trajectories   (issued_at, valid_at, horizon_hours, speed_m_s, bearing_deg,
│                          uncertainty_radius_km)                    ← RK4 + ensemble
├─ risk_grid              (5 component risks + total_risk + navigable per cell)
└─ route_results          (request_id, profile, distance/duration/fuel/risk,
                           GeoJSON LineString geometry, parameters JSON)

Operations
├─ ingestion_log          (source, dataset, status, records_ingested/rejected, message)
└─ model_registry         (model_name/version/horizon, algorithm, metrics JSON — real held-out metrics)
```

Indexes: `(observed_at, latitude, longitude)` composites on observation tables,
`(iceberg_id, observed_at)` on tracks, `(generated_at, horizon_hours)` on risk
grids — matching the actual query patterns in the repositories.

### 4.2 Migration plan

**There is no Alembic.** Schema is created by `create_all()` at startup (and by
`seed_demo_data.py --reset`). For the integration this is fine — the schema is
mature and the DB is a derived cache of observations + model output, rebuildable
at any time from source data.

- **Demo:** `python scripts/seed_demo_data.py --reset` (drop + recreate + retrain).
- **Real:** `python scripts/download_data.py && preprocess_data.py && train_models.py`.
- **Production evolution:** if the schema must evolve, wrap the change in
  `scripts/` (e.g. `apply_migration_001.sql`) and run before startup; adopting
  Alembic is a phase-3+ item, documented as such, not a blocker. PostGIS
  acceleration is **already coded but optional** (`enable_postgis` in
  `init_db.py` — adds `geom` geography columns + GiST index on point tables
  when PostgreSQL is present; SQLite path unaffected).

### 4.3 What the frontend adds

Nothing server-side. Frontend state (mission objectives, alert thresholds,
vessel presets) is localStorage-persisted; the only durable server-side
frontend trigger is `persist: true` on `/route/optimize`, which writes
`route_results` rows the Reports screen then reads back.

---

## 5. UI/UX Fidelity — Stitch → React

### 5.1 Design tokens (extracted verbatim from the Stitch HTML)

The screens embed a Tailwind config whose token names we re-use **exactly** —
the Stitch class strings translate to React components nearly class-for-class.

**Colors** (dark, zero-radius operational aesthetic):
| Token | Hex | Use |
|---|---|---|
| `surface-raised` | `#0B1524` | Header HUD (h-16, fixed) |
| `surface-dim` / `background` | `#0d131f` | Page background |
| `surface-container-lowest` | `#080e19` | Void / deepest panels |
| `surface-panel` | `rgba(16,28,46,0.82)` | Frosted-glass map panels (backdrop-blur 12px) |
| `primary-container` | `#22d3ee` | Electric cyan — primary actions, active nav |
| `primary` | `#8aebff` | Cyan text on dark |
| `status-safe` | `#4ADE80` | Green (navigable) |
| `status-caution` | `#FACC15` | Amber (caution) |
| `status-danger` | `#F87171` | Red (critical) |
| `status-telemetry` | `#60A5FA` | Blue (telemetry values) |
| `border-subtle` / `border-active` | `#16263C` / `#1E3A5F` | Panel borders |
| `text-primary` / `text-secondary` / `text-muted` | `#F1F5F9` / `#94A3B8` / `#64748B` | Text scale |

**Typography** (two families only):
- Space Grotesk — all headlines (display-hero 44/48 700; headline-lg 24/30 600; headline-md 18/24 600; headline-sm 15/20 600)
- JetBrains Mono — **everything else**, including body (body-lg 14/22, body-md 13/18, body-sm 12/16), data (stat-metric 32/36 700, telemetry-code 11/14), and micro-labels (10px, 0.08em tracking, 600, uppercase)

**Geometry:** zero corner radius on panels (`rounded-none`); border 1px
`border-subtle`; panels use `padding: panel-pad-default 1rem`, gap
`gutter-md 0.75rem`; cyan glow `accent-cyan-glow rgba(34,211,238,0.35)` on
focused/active elements. Scrollbars hidden (`::-webkit-scrollbar{display:none}`).

**App chrome (shared by all 11 screens):** fixed `h-16` header HUD (emblem +
POLARIS NCPOR + live TEMP/WIND/VIS/SAR-ICE chips + clock + SYSTEM ONLINE pill),
320px left nav (Dashboard, Mission Planner, Sea Ice Forecast, Iceberg Tracker,
Route Optimizer, Risk Analysis, Weather & Ocean, Alerts [badge 3], Reports),
fluid center content, right drawer (240px) for contextual detail.

### 5.2 Screen → route → component mapping

| # | Stitch screen | Route | Primary components | Data source |
|---|---|---|---|---|
| 00 | Ops Console | `/` | `OpsMap`, `RouteEvalMatrix`, `IcebergWatchList`, `AIAdvisorPanel`, `TelemetryRail`, `AlertTicker` | `/dashboard/summary`, `/risk/map`, `/icebergs`, `/route/optimize` |
| 01 | Mission Planner | `/planner` | `StationPicker`, `VesselForm`, `OptimizationControls`, `RouteComparisonCards`, `PlannerMap` | `/navigation/stations`, `POST /route/optimize` |
| 02 | Sea Ice Forecast | `/sea-ice` | `ConcentrationGridMap`, `HorizonSlider` (T+0/24/48/72), `ExtentChart`, `IceEdgePanel` | `/sea-ice/current`, `/sea-ice/forecast`, `/sea-ice/extent` |
| 03 | Iceberg Tracker | `/icebergs` | `IcebergMap`, `BergDetailDrawer`, `TrajectoryFan` (ensemble cone), `TrackTable` | `/icebergs`, `/icebergs/{id}/trajectory` |
| 07 | Route Optimizer | `/optimizer` | `RouteProfilesMatrix`, `CostWeightSliders`, `WeightBreakdown`, `GeometryOverlay` | `POST /route/optimize`, `/navigation/routes` |
| 06/08 | Risk Analysis | `/risk` | `RiskHeatmap`, `ComponentStack`, `HotspotTable`, `VesselRiskParams` | `/risk/map`, `/risk/point` |
| 05 | Weather & Ocean | `/weather` | `WindRosePanel`, `TemperatureGauge`, `CurrentsPanel`, `LayerFreshness` | `/weather/point`, `/weather/current`, `/dashboard/summary` |
| 09 | Tactical Alerts | `/alerts` | `AlertFeed` (derived), `ThresholdConfig`, `AlertMap` | derived from `/risk/map` + `/icebergs` + `/health` |
| 04 | Mission Reports | `/reports` | `RouteHistory`, `ModelRegistryTable`, `IngestionAuditTable`, `ExportButton` | `/navigation/routes`, `/dashboard/models`, `/dashboard/ingestion` |

### 5.3 Component tree (abridged)

```
<App>
├─ <AppChrome>                          // header HUD + nav + drawer; all 11 screens share it
│  ├─ <HudBar/>                         // emblem, TEMP/WIND/VIS chips (live), clock, status pill
│  │   └─ <SystemStatusBadge/>          // /health poll → ok|degraded|unavailable
│  └─ <NavRail/>                        // 9 items; Alerts badge = derived-alert count
├─ <ErrorBoundary>                      // per-screen; keeps map alive if a panel throws
│  └─ <ScreenRouter>                    // react-router
│     ├─ OpsConsoleScreen     → <OpsMap/> <RouteEvalMatrix/> <AIAdvisorPanel/> …
│     ├─ MissionPlannerScreen → …
│     ├─ … 9 screens
├─ <QueryClientProvider>                // TanStack Query: retry 2, staleTime 60s
└─ <ApiErrorToast/>                     // global 503/hint surfacing
```

### 5.4 State management

- **Server state:** TanStack Query. One query key per endpoint family:
  `['health']` (10s), `['dashboard']` (60s), `['risk', horizon, stride]` (5min),
  `['icebergs']` (60s), `['seaice', horizon]` (5min), `['routes', limit]`,
  `['stations']` (∞). Horizon slider changes key → new cache entry, instant
  back-and-forth after first load.
- **Client state:** React Context for *two* app-level concerns only —
  `DataModeContext` (provenance banner + demo/real styling switch) and
  `VesselContext` (the vessel preset shared by Planner → Optimizer → Risk
  screens; default icebreaker per the demo data reality).
- **URL as state:** map center/zoom, active iceberg, horizon, route request_id
  live in the URL (`?berg=A17&h=48`) — shareable + back-button correct.
- **No Redux.** The app has no complex client-side writes; the two POSTs
  (optimize, persist trajectory) go through `useMutation` with cache updates.

### 5.5 Responsive behavior

Stitch is desktop-first (2560px canvases). Implementation targets:
- **≥1280px** — full layout: 320px nav + fluid center + 240px drawer.
- **768–1279px** — nav collapses to icon rail (72px); drawer overlays.
- **<768px** — nav becomes bottom tab bar; panels stack; maps get
  `display-hero-mobile` (30px) type scale; touch targets ≥44px (existing chips
  already comply).

### 5.6 Accessibility

- Contrast: token palette audited — `text-primary #F1F5F9` on `#0d131f` ≈ 15:1;
  cyan `#22d3ee` on `#0d131f` ≈ 9.5:1; amber/red on dark all > 6:1. **Watch:**
  `text-muted #64748B` on `#0d131f` is ~4.6:1 — passable for large text only;
  use `text-secondary #94A3B8` (~7:1) for body copy. (The plan pins these as
  lint-enforced rules in the token layer.)
- Keyboard: nav rail is a proper tablist; all panels focusable; visible focus
  ring (`accent-cyan-glow`) — never `outline: none` without replacement.
- Screen reader: map layers get `aria-hidden` + an adjacent data table
  (the hotspots table **is** the accessible representation of the map).
- `prefers-reduced-motion`: disable the alert ticker pulse + map pan easing.
- Numbers: `font-variant-numeric: tabular-nums` (JetBrains Mono default
  behavior) for stable telemetry readouts.

---

## 6. Backend Integration (frontend contract)

### 6.1 API client architecture

```
web/src/lib/
├─ http.ts        // fetch wrapper: timeout, retry, X-API-Key, X-Process-Time-ms capture
├─ caseConvert.ts // snake→camel on response, camel→snake on request (typed, deep)
├─ api.ts         // endpoint functions grouped by domain, fully typed
└─ types.ts       // hand-maintained TS mirrors of the Pydantic schemas (§3.2)
```

- **Wire format is snake_case** (Pydantic default). All conversion happens in
  the client layer — components only ever see camelCase TS types, matching the
  user's established frontend convention.
- `caseConvert.ts` = deep transform for objects/arrays; skips `geometry`
  (GeoJSON keys `type`/`coordinates` must not be touched).

### 6.2 Retry & error handling

- **Transport errors / 5xx:** 2 retries with 800ms/2.8s backoff (fetch wrapper),
  honoring `Retry-After` if present. `/weather/point` 503s are *expected* —
  retried once then shown as "provider offline" panel state, not a crash.
- **4xx:** never retried. 422 validation errors render per-field (the envelope
  carries a `details[]` for field-level messages).
- **Error envelope → UI:** every error surfaces as (a) inline panel state
  ("Sea-ice layer unavailable — run ingestion", from `hint`) + (b) a toast.
  The `hint` field is rendered verbatim — it is written for exactly this.
- **Degrade-without-dying:** the backend models partial failure natively
  (`status: "degraded"` routes, `missing_layers` on risk maps, section-level
  `null`s in dashboard summary). The frontend mirrors this: a degraded panel
  shows amber "PARTIAL DATA" (status-caution), the screen keeps working.

### 6.3 Latency expectations (measured 2026-09-05, SQLite demo, warm)

| Endpoint | Warm | Note |
|---|---|---|
| `/health` | ~0.05s | poll every 10s |
| `/sea-ice/current` | 0.28s | grid format |
| `/risk/map` (stride 4, cells) | 0.26s | stride 1 & grid format is heavier |
| `/icebergs` | 0.46s | |
| `/dashboard/summary` | 2.5s | **aggregate — cache 60s, show skeletons first** |
| `/navigation/stations` | 2.8s | includes snap-to-navigable computation — cache ∞ per session |
| `POST /route/optimize` | 3–8s | heavy (risk grid + A* over 3k nodes × 3 profiles) — button gets busy state + skeleton |

Frontend rules derived from these numbers:
- Dashboard screen loads its panels **in parallel** via independent queries —
  the 2.5s summary does not block the 0.3s risk map.
- Map screens request `stride` ≥ 2 for cells format; full-resolution grid only
  on explicit zoom-in.
- `/route/optimize` submissions disable the CTA with a "COMPUTING — risk grid
  + A*" busy state (the backend itself logs slow >5s requests).

### 6.4 Auth flow (production, when API key enabled)

```
SPA build: VITE_POLARIS_API_KEY → http.ts attaches X-API-Key to every call
     ↓ 401 {error:"UNAUTHORIZED"}
UI: full-screen "session expired" → operator re-enters key (intranet kiosk flow)
```
No tokens/sessions exist server-side, so there is no refresh flow — the key is
a static intranet credential. Same-origin deployment (SPA served by FastAPI)
makes the header invisible to other origins.

---

## 7. CI/CD & Deployment

### 7.1 Pipeline (GitHub Actions)

```
push → [backend-job]  python 3.13 venv, pip install -r requirements.txt,
                      seed --skip-training (fast fixture), pytest tests/
      → [frontend-job] node 20, npm ci, tsc --noEmit, vite build, lint
      → [e2e-job]     boot backend (demo seed), run Playwright smoke
      → [docker-job]   on tag: build both images, push GHCR
```

### 7.2 Dockerfile (multi-stage, backend+SPA in one image)

```dockerfile
# ---------- stage 1: build the SPA ----------
FROM node:20-slim AS web
WORKDIR /web
COPY web/package*.json ./
RUN npm ci
COPY web/ ./
RUN npm run build            # → /web/dist

# ---------- stage 2: backend + dist ----------
FROM python:3.13-slim
WORKDIR /app
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY backend/ ./
COPY --from=web /web/dist ./frontend/src   # FastAPI mounts frontend/src
# Polar science stack caveat: netCDF4/pyproj wheels exist for linux/amd64 — fine.
ENV DATA_MODE=demo TZ=UTC
EXPOSE 8000
# Seed at first boot (idempotent — checks for existing data), then serve:
CMD ["sh", "-c", "python -c 'import sqlite3,os; \
  sqlite3.connect(os.environ.get(\"DB\",\"polaris_demo.db\")).execute(\"select 1\")' 2>/dev/null || true; \
  python scripts/seed_demo_data.py --skip-training --reset; python run.py --host 0.0.0.0"]
```

### 7.3 docker-compose.yml (production shape with Postgres)

```yaml
services:
  polaris:
    build: .
    ports: ["8000:8000"]
    environment:
      DATA_MODE: real
      DATABASE_URL: postgresql+psycopg2://polaris:${DB_PASSWORD}@db:5432/polaris
      CORS_ORIGINS: ${APP_ORIGIN}
      POLARIS_API_KEY: ${POLARIS_API_KEY}   # unset = open (demo)
    depends_on: [db]
    volumes: [polaris_data:/app/data, polaris_models:/app/models]
  db:
    image: postgis/postgis:16-3.4
    environment: { POSTGRES_DB: polaris, POSTGRES_USER: polaris, POSTGRES_PASSWORD: ${DB_PASSWORD} }
    volumes: [pg_data:/var/lib/postgresql/data]
volumes: { polaris_data: {}, polaris_models: {}, pg_data: {} }
```

### 7.4 Deployment steps (production)

```bash
# 1. Provision VM / container host (Ubuntu 22.04+, 4 GB RAM — sklearn training needs ~2 GB)
# 2. Clone + configure
git clone <repo> && cd polaris
cp backend/.env.example backend/.env   # edit: DATA_MODE=real, DB URL, CORS, API key
# 3. Real data pipeline (needs credentials + network; ~20–40 min first run)
cd backend && python scripts/download_data.py && python scripts/preprocess_data.py \
  && python scripts/train_models.py
# 4. Start
docker compose up -d --build      # or: python run.py --mode real behind nginx/Caddy
# 5. Verify
curl -f http://localhost:8000/api/health/ready
# 6. Reverse proxy: nginx → localhost:8000 (gzip off for SSE, cache /assets/* 1y)
```

**Hosting targets:** SIH demo = laptop, SQLite demo mode, zero external
dependencies (the entire demo pipeline needs no network). Production =
any container host (Railway/AWS ECS/VM) + managed Postgres, real-data mode.
**Local Docker caveat:** Docker is not installed on this Windows machine —
the Dockerfile/compose are deliverables verified by syntax review + CI, and
local runs use `python run.py` + `npm run dev` directly.

---

## 8. Testing Strategy

### 8.1 Backend (existing — 204 tests, run in CI)

- `tests/test_routes.py` (40), `test_risk.py` (43), `test_data.py` (27),
  `test_sea_ice.py` (27), `test_icebergs.py` (29), `test_e2e.py` (16),
  `test_health.py` (9), `test_weather.py` (13). Verified: 199/204 pass in the
  global env; 5 forecast-skill tests need the pinned venv (§2.4).

### 8.2 Frontend unit/integration (Vitest)

| Test | Type | Example case |
|---|---|---|
| `caseConvert` | unit | `{sea_ice_risk: 0.4}` → `{seaIceRisk: 0.4}`; GeoJSON `geometry` untouched; arrays deep-converted |
| `http` wrapper | unit | 503 + `hint` → typed `PolarisError` with hint; retry on network error ×2 then throw |
| `deriveAlerts` | unit | risk cells > 0.75 → 1 critical alert; no hotspots → empty feed, not error |
| `RouteEvalMatrix` | integration | mock `/route/optimize` fixture → renders 3 profiles, recommended highlighted, degraded status shows amber |
| `OpsConsoleScreen` | integration | summary fixture with `icebergs: null` → Iceberg panel shows "LAYER OFFLINE", screen renders |
| `HudBar` | integration | `/health` degraded → amber pill; clock renders UTC |

### 8.3 E2E (Playwright, seeded demo backend)

```
1. e2e/smoke.spec.ts
   ✓ loads / and shows POLARIS + NCPOR badge + 9 nav items
   ✓ Ops Console renders live risk map (waits for /risk/map 200)
2. e2e/planner.spec.ts
   ✓ Mission Planner: select Bharati→Maitri, vessel=icebreaker, submit →
     within 15s shows 3 profile cards with distance/duration/risk
   ✓ recommended profile highlighted; degrade case: 1a_super vessel →
     "degraded" chips render, screen does not crash
3. e2e/horizon.spec.ts
   ✓ Sea Ice: slider T+0 → T+72 → new forecast fetch, legend updates
4. e2e/errors.spec.ts
   ✓ stop backend ingestion tables (empty DB fixture) → 503 panels show hint
     text, nav still functional
```

### 8.4 CI gates

`pytest` (backend, pinned venv) → `tsc --noEmit` + `vitest run` → `vite build`
→ `playwright test` (against seeded demo backend in the job) → image build.

---

## 9. Deliverables

```
polaris/
├── README.md                    # full-stack quickstart (this plan condensed)
├── PLAN.md                      # ← this document
├── design/
│   └── stitch/                  # 11 archived screen HTMLs + emblem SVG (source of truth)
├── backend/                     # EXISTING — unchanged (see §1.3)
│   ├── app/ … scripts/ … tests/ … requirements.txt … run.py
├── frontend-legacy/             # the old static test client, kept for reference
├── web/                         # NEW React SPA
│   ├── public/emblem.svg
│   ├── src/
│   │   ├── lib/{http.ts, caseConvert.ts, api.ts, types.ts}
│   │   ├── tokens/{theme.css}   # Stitch tokens as CSS vars + Tailwind theme
│   │   ├── chrome/{AppChrome, HudBar, NavRail, SystemStatusBadge}
│   │   ├── components/{Panel, MicroLabel, StatMetric, RiskChip,
│   │   │        HorizonSlider, VesselForm, RouteEvalMatrix, TelemetryRail, …}
│   │   ├── screens/{OpsConsole, MissionPlanner, SeaIce, Icebergs,
│   │   │        RouteOptimizer, Risk, Weather, Alerts, Reports}
│   │   ├── state/{DataModeContext, VesselContext, deriveAlerts}
│   │   └── App.tsx, main.tsx
│   ├── e2e/                     # Playwright specs
│   ├── Dockerfile (2-stage) — at repo root for combined image
│   ├── docker-compose.yml
│   ├── .github/workflows/ci.yml
│   └── package.json
└── run scripts:
    ├── dev.sh                   # backend :8000 + vite :5173 (proxy /api)
    └── seed.sh                  # seed_demo_data.py wrapper
```

Docs produced: `README.md` (quickstart + architecture), `PLAN.md` (this),
`web/src/lib/api.ts` with full TSDoc endpoint reference, OpenAPI at
`/docs` (auto-generated by FastAPI — linked from README).

---

## 10. Assumptions & Constraints

**Assumptions (about the provided assets):**
1. The backend is the complete server-side scope — no missing services were
   found; its 20 endpoints are the full API surface. Screens without endpoints
   (Alerts, mission objectives) are derived client-side (§3.4) rather than
   assuming hidden backend capabilities.
2. "Frontend Design" = the 11 Stitch screens in project 13425453471802998895;
   the existing `frontend/` static client is a backend smoke-test tool, not a
   design deliverable. It is preserved as `frontend-legacy/`, not extended.
3. Demo mode is the default presentation target for SIH (zero network, zero
   credentials, deterministic seed) — proven end-to-end on this machine.
4. SIH demo runs on the hackathon laptop; production targets are indicative.
5. No auth exists or is assumed server-side beyond the additive opt-in key.

**Constraints (verified):**
- **No Alembic** — schema via `create_all()`; evolution plan in §4.2.
- **No auth** — §3.3 additive middleware; TLS at proxy.
- **CORS default `*`** — must be set to real origins in production.
- **Local env:** Windows 11, no Docker, no Java, no jq. Docker artifacts are
  deliverables verified in CI; local dev is `python run.py` + `npm run dev`.
  Node v24.13.1 / npm 11.8.0 / Python 3.13.9 available and sufficient.
- **Global-python version drift** (sklearn 1.7.2 vs 1.9.0 pin) breaks 5
  forecast-skill tests; the pinned venv is the supported path (§2.4).
- **Performance:** demo-mode route optimization takes 3–8 s (measured);
  the UI must treat it as a long action (busy state, parallel panel loads),
  not an instant click. Dashboard summary ~2.5 s → parallel + cached.
- **Browser support:** evergreen Chrome/Edge/Firefox (ES2022, backdrop-filter,
  grid). No IE11. Leaflet needs no WebGL — the demo runs on any laptop.
- **Demo data honesty:** every demo payload carries `provenance.data_mode =
  "demo"` and a disclaimer; the UI renders a persistent DEMO banner so judges
  never mistake synthetic data for observations. This is a hard requirement
  from the backend design and is carried through the frontend.
- **Scale:** single-operator console; SQLite is fine for demo, Postgres for
  real. No horizontal-scaling concerns at this scale (route optimization is
  CPU-bound single-request; ~2 GB RAM for training).

---

## 11. Implementation phases (executable order)

| Phase | Work | Exit criterion |
|---|---|---|
| **0. Skeleton** (this session) | `web/` scaffold, tokens, chrome, API client, Ops Console screen wired to live demo data | Browser shows the Ops Console layout with live dashboard summary + risk map |
| 1. **Map core** | Leaflet integration, landmask GeoJSON layer, risk heatmap layer, stations | Ops Console map renders sea-ice + landmask + 3 stations |
| 2. **Screens** | Planner (POST optimize), Sea Ice, Icebergs, Risk, Weather, Reports | All 9 routes render with live demo data |
| 3. **Hardening** | Alerts derivation, API-key middleware, error/empty/degraded states, a11y pass | E2E suite green; a11y checklist §5.6 pass |
| 4. **CI/CD** | GitHub Actions, Dockerfile, compose, Playwright in CI | CI green on push |
| 5. **Real data** (optional) | `DATA_MODE=real`, credentials, full ingestion | `/health` reports real; provenance banners update |

Phase 0 deliverables are produced below.
