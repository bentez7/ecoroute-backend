# Carbon Aware Route Planner — Backend Context for Claude Code

## Project Overview

A **behaviour-aware carbon tracking mobile app** that combines:
- **FASTSim** (NREL physics-based vehicle simulator) for trip-level energy & CO2 estimation
- **XGBoost + SHAP** for driving behaviour classification (smooth / normal / aggressive)
- **RouteE Compass** for energy-aware route comparison + **Mapbox** for map matching and place search
- **Supabase** for database, auth, and Realtime subscriptions

The app captures 1 Hz telemetry during trips, analyses 12 behavioural features across 60-second segments, and delivers post-trip feedback to help drivers reduce emissions by 15–25%.

---

## ⚠️ Scope of This Repository

**This repo is the backend only** — Supabase database, auth, and API layer.

The ML models (XGBoost + SHAP) and FASTSim simulation engine live in a **separate repository** (`carbon-aware-ml` or similar). Do not implement, scaffold, or reference model training code here.

### What this repo IS responsible for:
- Supabase Auth (sign-up, sign-in, session management, profile trigger)
- PostgreSQL schema, migrations, RLS policies, indexes
- REST API endpoints for the mobile app (trips, telemetry, vehicles, feedback, routes)
- **Calling the ML service** to analyse telemetry and receive results synchronously
- Storing telemetry, trip data, segment results, and feedback events
- Route comparison via RouteE Compass + Mapbox Map Matching
- Serving data to the mobile app (the frontend subscribes to Supabase Realtime for live updates)

### What this repo is NOT responsible for:
- Running FASTSim simulations (handled in the ML service)
- Training or running the XGBoost model (handled in the ML service)
- Computing SHAP values (handled in the ML service)
- Any Python ML dependencies (numpy, scikit-learn, fastsim, xgboost, shap)

### How the ML service connects:
This backend **calls out** to the ML service via HTTP (see `MlService.helper.js`). The ML service is a stateless HTTP API — it receives telemetry points, runs analysis, and returns results in the response. The backend then writes those results to Supabase. There are **no inbound endpoints** for the ML service to push data to this backend.

---

## What We Are Building

A **Supabase backend** that covers:
1. **Authentication** — Supabase Auth (email/password + optional OAuth)
2. **Database schema** — all tables, relationships, RLS policies
3. **API endpoints** — for the mobile app to send/receive data
4. **ML integration** — backend calls the ML service and writes results to the DB
5. **Realtime** — Supabase Realtime enabled on `feedback_events` so the frontend receives live updates

---

## Architecture (Four-Tier)

```
Mobile App (Flutter / React Native)
    │
    ├── Navigation Module       → Mapbox / Google Maps
    ├── Data Collection Module  → 1 Hz GPS + accelerometer telemetry
    ├── Realtime Subscriptions  → Supabase Realtime (feedback_events)
    │
    ▼
Express Backend (this repo)
    ├── Auth (Supabase Auth)
    ├── REST API
    ├── PostgreSQL (Supabase)
    │
    ├── calls ──► ML Service (separate repo)
    │               ├── XGBoost (driver behaviour classification)
    │               └── SHAP (explainability)
    │
    └── calls ──► RouteE Compass (routing + energy estimates)
                    └── enriched via Mapbox Map Matching
```

---

## Database Schema (Implemented)

See `supabase/migrations/` (001–008) for the full SQL. Summary of tables:

- **`users`** — extends `auth.users`. Fields: `id`, `email`, `display_name`, `avatar_url`, `role`, `account_status`, `auth_provider`, `created_at`, `updated_at`
- **`vehicles`** — user's garage. Fields: `id`, `user_id`, `make`, `model`, `year`, `vehicle_type`, `vehicle_mass_kg`, `drag_coefficient`, `drivetrain_type`, `is_default`, `created_at`, `updated_at`
- **`trips`** — trip lifecycle. Fields: `id`, `user_id`, `vehicle_id`, `status` (`active`|`ended`|`cancelled`), `started_at`, `ended_at`, `distance_km`, `duration_sec`, `route_polyline`, `origin_lat/lng`, `origin_address`, `dest_lat/lng`, `dest_address`, `fuel_type`, `energy_kwh`, `co2_kg`, `excess_vs_optimal_pct`, `driver_profile`, `created_at`
- **`telemetry_segments`** — 60-second behavioural segments. Includes `behaviour_label` (`smooth`|`moderate`|`aggressive`), `confidence`, `xgboost_efficiency_label`, `shap_top_feature`
- **`raw_telemetry`** — 1 Hz GPS + motion data (bigserial PK, high-volume)
- **`route_comparisons`** — post-trip alternatives. `route_label`: `eco` | `balanced` | `fastest`
- **`feedback_events`** — behavioural nudges. Supabase Realtime enabled on this table

---

## Emission Conversion Factors (IPCC)

Use these in computed columns or application logic:
- **LPG**: 69,300 kg CO2/TJ → 0.2496 kg CO2/kWh
- **Diesel**: 74,100 kg CO2/TJ → 0.2668 kg CO2/kWh
- **Petrol**: 69,300 kg CO2/TJ → 0.2496 kg CO2/kWh
- **EV**: use grid intensity factor (Malaysia ~0.585 kg CO2/kWh, TNB 2023)

---

## Supabase Auth (Implemented)

- **Email/Password** sign-up enabled
- Auto-creates a `users` row on sign-up via a **database trigger** on `auth.users`
- RLS: users can only read/write their own data across all tables

---

## Row Level Security (RLS) Policies

Apply to ALL tables. Pattern:
```sql
-- Enable RLS
alter table trips enable row level security;

-- Users can only see their own trips
create policy "Users see own trips"
  on trips for select
  using (auth.uid() = user_id);

create policy "Users insert own trips"
  on trips for insert
  with check (auth.uid() = user_id);

create policy "Users update own trips"
  on trips for update
  using (auth.uid() = user_id);
```

Applied to all tables: `users`, `vehicles`, `trips`, `telemetry_segments`, `raw_telemetry`, `route_comparisons`, `feedback_events`.

---

## Indexes to Create

```sql
create index idx_trips_user_id on trips(user_id);
create index idx_trips_started_at on trips(started_at desc);
create index idx_telemetry_segments_trip_id on telemetry_segments(trip_id);
create index idx_raw_telemetry_trip_id on raw_telemetry(trip_id);
create index idx_raw_telemetry_recorded_at on raw_telemetry(recorded_at);
create index idx_feedback_events_trip_id on feedback_events(trip_id);
```

---

## Tech Stack

### This Repo (Backend)
| Layer | Technology |
|-------|-----------|
| Database | Supabase (PostgreSQL 15) |
| Auth | Supabase Auth |
| Runtime | Node.js |
| Framework | Express.js |
| Language | JavaScript (CommonJS, `require`) |
| Routing | RouteE Compass API + Mapbox Map Matching |
| Place search | Mapbox Search API |
| Mobile client | Flutter or React Native (consumes this backend) |

### Separate ML Service (not built here — for context only)
| Layer | Technology |
|-------|-----------|
| Behaviour model | XGBoost + SHAP (Python, scikit-learn pipeline) |
| Runtime | Python HTTP service — this backend calls it, it returns results |

---

## Folder Structure (Follow This Exactly)

Based on the standard Node.js + Express architecture. Use `module-alias` for `@routes`, `@controllers` etc. path aliases.

```
/
├── app/
│   ├── config/
│   │   ├── app.conf.js          # App-level config (port, env, CORS origins)
│   │   ├── app.keys.js          # Supabase keys, Mapbox key, RouteE key (loaded from .env)
│   │   ├── db.conf.js           # Supabase connection config
│   │   ├── swagger.conf.js      # Swagger/OpenAPI spec generation
│   │   └── init.js              # Exports all config together
│   │
│   ├── database/
│   │   ├── models/              # Supabase query models (User, Vehicle, Trip, etc.)
│   │   ├── Supabase.database.js # Supabase client singleton (anon + service role)
│   │   └── init.js
│   │
│   ├── routes/
│   │   ├── Auth.routes.js       # POST /auth/signup, /auth/signin, /auth/signout, GET /auth/me
│   │   ├── Vehicle.routes.js    # Vehicle CRUD, make/model/variant catalog
│   │   ├── Trip.routes.js       # Trip CRUD, start/end lifecycle
│   │   ├── Telemetry.routes.js  # Bulk insert raw_telemetry, get by trip
│   │   ├── Segment.routes.js    # Read telemetry_segments
│   │   ├── Route.routes.js      # Autocomplete, route search, post-trip comparisons
│   │   ├── Feedback.routes.js   # feedback_events read + acknowledge
│   │   └── init.js              # Mounts all routers onto Express app
│   │
│   ├── controllers/
│   │   ├── Auth.controller.js
│   │   ├── Vehicle.controller.js
│   │   ├── Trip.controller.js
│   │   ├── Telemetry.controller.js
│   │   ├── Segment.controller.js
│   │   ├── Route.controller.js
│   │   └── Feedback.controller.js
│   │
│   ├── services/                # Business logic layer (called by controllers)
│   │   ├── User.service.js
│   │   ├── Vehicle.service.js
│   │   ├── Trip.service.js
│   │   ├── Telemetry.service.js
│   │   ├── Segment.service.js
│   │   ├── RouteComparison.service.js
│   │   ├── FeedbackEvent.service.js
│   │   └── init.js
│   │
│   ├── dto/                     # Data transfer objects (response shaping)
│   │   ├── Auth.dto.js
│   │   ├── User.dto.js
│   │   ├── Vehicle.dto.js
│   │   ├── Trip.dto.js
│   │   ├── Route.dto.js
│   │   └── index.js
│   │
│   ├── middleware/
│   │   ├── Auth.middleware.js        # Validate Supabase JWT from Authorization header
│   │   ├── ServiceRole.middleware.js # Validate service-role key (currently unused)
│   │   ├── ErrorHandler.middleware.js
│   │   ├── Validate.middleware.js    # Request body validation (express-validator)
│   │   └── init.js
│   │
│   ├── helpers/
│   │   ├── Supabase.helper.js       # Shared Supabase query helpers
│   │   ├── Emission.helper.js       # CO2 conversion factor lookups (IPCC constants)
│   │   ├── Response.helper.js       # Standardised API response shape {success, data, error}
│   │   ├── Pagination.helper.js     # Offset-based pagination utilities
│   │   ├── MlService.helper.js      # HTTP client for calling the ML service
│   │   ├── RoutingService.helper.js # RouteE Compass + route comparison logic
│   │   └── MapboxService.helper.js  # Mapbox Search + Map Matching
│   │
│   └── utils/
│       └── Logger.util.js       # Winston logger
│
├── supabase/
│   └── migrations/              # 001 through 008
│
├── samples/
│   └── .env.sample
│
├── server.js        # Entry point — creates Express app, loads middleware, starts server
├── package.json
├── .env             # Never commit — see samples/
└── .gitignore
```

### Key Conventions
- All `init.js` files aggregate and export their folder's modules so consumers need one `require`
- Controllers are thin — business logic goes in services and helpers
- `Emission.helper.js` holds the IPCC conversion constants (do not scatter these across controllers)
- Always return a consistent response shape: `{ success: true, data: {...} }` or `{ success: false, error: "message" }`
- The backend **calls out** to the ML service (via `MlService.helper.js`) — there are no inbound ML endpoints
- The frontend subscribes to **Supabase Realtime** on `feedback_events` for live in-trip notifications

---

## Agents Available in `.claude/agents/`

- `database-architect.md` — Schema design, migrations, indexing ✅ use this
- `supabase-schema-architect.md` — Supabase-specific schema, RLS, triggers ✅ use this
- `ai-engineer.md` — ML model integration ⚠️ relevant only when designing the API contract between this backend and the ML repo
- `ml-engineer.md` — FASTSim/XGBoost ⚠️ do NOT use for building this repo — ML lives in the separate repo

## Skills Available in `.claude/skills/`

- `supabase-postgres-best-practices` — Supabase-specific patterns ✅ use this
- `senior-backend` — API design, async patterns ✅ use this
- `code-reviewer` — PR review, code quality ✅ use this
- `docx` — Documentation output

---

## Environment Variables Required

```env
SUPABASE_URL=https://<project-ref>.supabase.co
SUPABASE_ANON_KEY=<anon-key>
SUPABASE_SERVICE_ROLE_KEY=<service-role-key>  # server-side only, never expose to client
GOOGLE_MAPS_API_KEY=<key>
MAPBOX_API_KEY=<key>

# Routing
ROUTING_SERVICE_URL=http://localhost:8080      # RouteE Compass base URL
ROUTEE_API_KEY=<key>

# ML Service — this backend calls out to it
ML_SERVICE_URL=http://localhost:8000
```

---

## Key Business Rules

1. A `trip` starts with `POST /api/trips` (status = `active`) and ends with `PATCH /api/trips/:id/end`
2. During an active trip, the mobile app streams telemetry via `POST /api/telemetry` in batches (every 30–60s)
3. On each telemetry batch, the backend **calls the ML service** (`MlService.helper.js`) which returns segment analysis — the backend writes segments and feedback events to the DB
4. The frontend subscribes to **Supabase Realtime** on `feedback_events` to receive live behavioural nudges during the trip
5. When a trip ends, `Trip.controller.js` runs **async background processing**: aggregates segment energy into trip-level totals, derives `driver_profile`, fetches route comparisons from RouteE Compass, and stores everything
6. `co2_kg` reference: LPG 0.2496 kg/kWh, Diesel 0.2668 kg/kWh, Petrol 0.2496 kg/kWh, EV ~0.585 kg/kWh (Malaysia grid)
7. Route comparisons (eco / balanced / fastest) are fetched from RouteE Compass and enriched with Mapbox Map Matching for road-snapped polylines
8. `raw_telemetry` may be pruned after 30 days (retain aggregated segment data permanently)

---

## Completed Work

- [x] Database schema — 8 migrations (001–008) covering all tables, indexes, RLS, auth trigger, Realtime
- [x] Supabase client setup — anon + service role clients
- [x] Auth flow — signup, signin, signout, GET /auth/me, profile auto-creation trigger
- [x] Vehicle management — full CRUD, make/model/variant catalog, default vehicle logic
- [x] Trip lifecycle — create (active), end (with async background processing), update, list, get
- [x] Telemetry ingestion — bulk insert with async ML segment analysis
- [x] Segment retrieval — by trip and by ID
- [x] Route search — RouteE Compass integration with Mapbox Map Matching enrichment
- [x] Route comparisons — stored post-trip via async background processing
- [x] Place autocomplete — Mapbox Search API
- [x] Feedback events — list by trip, acknowledge
- [x] Supabase Realtime — enabled on `feedback_events` table
- [x] API documentation — `report.md` with full endpoint reference and frontend integration guide

## Remaining Tasks

1. **Tests** — no test framework or test files exist yet
2. **Trip cancellation** — `status` supports `cancelled` but no endpoint sets it
3. **Trips pagination** — `GET /api/trips` returns all trips, no offset/limit support
4. **Clean up `console.log`** in `RoutingService.helper.js`