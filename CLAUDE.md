# Carbon Aware Route Planner — Backend Context for Claude Code

## Project Overview

A **behaviour-aware carbon tracking mobile app** that combines:
- **FASTSim** (NREL physics-based vehicle simulator) for trip-level energy & CO2 estimation
- **XGBoost + SHAP** for driving behaviour classification (smooth / normal / aggressive)
- **Google Maps API** for navigation and route comparison
- **Supabase** for database + auth (this is what we are building now)

The app captures 1 Hz telemetry during trips, analyses 12 behavioural features across 60-second segments, and delivers post-trip feedback to help drivers reduce emissions by 15–25%.

---

## ⚠️ Scope of This Repository

**This repo is the backend only** — Supabase database, auth, and API layer.

The ML models (XGBoost + SHAP) and FASTSim simulation engine live in a **separate repository** (`carbon-aware-ml` or similar). Do not implement, scaffold, or reference model training code here.

### What this repo IS responsible for:
- Supabase Auth (sign-up, sign-in, session management, profile trigger)
- PostgreSQL schema, migrations, RLS policies, indexes
- REST API endpoints that **receive** pre-computed results from the ML repo
- Storing telemetry, trip data, segment results, and feedback events
- Route comparison data (energies + CO2 already computed externally)
- Serving data to the mobile app

### What this repo is NOT responsible for:
- Running FASTSim simulations (handled in the ML repo)
- Training or running the XGBoost model (handled in the ML repo)
- Computing SHAP values (handled in the ML repo)
- Any Python ML dependencies (numpy, scikit-learn, fastsim, xgboost, shap)

### How the ML repo connects to this backend:
The ML repo calls this backend's API endpoints (authenticated via Supabase service role key) to **write back results** after processing. For example, after a trip ends, the ML repo computes `energy_kwh`, `co2_kg`, `driver_profile`, and segment-level features, then POSTs them to this backend to persist into the database.

---

## What We Are Building

A **Supabase backend** that covers:
1. **Authentication** — Supabase Auth (email/password + optional OAuth)
2. **Database schema** — all tables, relationships, RLS policies
3. **API endpoints** — to receive data from the mobile app and ML repo
4. **TypeScript/Python client helpers** — typed Supabase client for the mobile app

---

## Architecture (Four-Tier)

```
Mobile App (Flutter / React Native)
    │
    ├── Navigation Module       → Google Maps API
    ├── Data Collection Module  → 1 Hz GPS + accelerometer telemetry
    │
    ▼
Supabase Backend  ◄──────────────────────────────────────────────┐
    ├── Auth (users)                                              │
    ├── PostgreSQL Database                                       │
    └── REST API                                                  │
            │                                            writes back results
            │ stores raw telemetry                               │
            ▼                                                    │
    ML Repo (separate)  ─────────────────────────────────────────┘
    ├── FASTSim (energy & CO2 simulation)
    ├── XGBoost (driver behaviour classification)
    └── SHAP (explainability)
```

---

## Database Schema to Implement

### Table: `profiles`
Extends Supabase `auth.users`. One row per user.
```
id            uuid  PK  references auth.users(id)
display_name  text
vehicle_type  text        -- 'petrol' | 'diesel' | 'lpg' | 'ev' | 'hybrid'
vehicle_mass_kg  float   -- for FASTSim parameterisation
drag_coefficient float
drivetrain_type  text    -- 'fwd' | 'rwd' | 'awd'
created_at    timestamptz
updated_at    timestamptz
```

### Table: `trips`
One row per completed trip.
```
id              uuid  PK default gen_random_uuid()
user_id         uuid  FK → profiles(id)
started_at      timestamptz
ended_at        timestamptz
distance_km     float
duration_sec    int
route_polyline  text        -- encoded Google Maps polyline
origin_lat      float
origin_lng      float
dest_lat        float
dest_lng        float
fuel_type       text        -- inherited from vehicle at time of trip
energy_kwh      float       -- FASTSim output
co2_kg          float       -- IPCC conversion factor applied
excess_vs_optimal_pct float -- (actual - optimal) / optimal * 100
driver_profile  text        -- 'smooth' | 'normal' | 'aggressive'  (XGBoost output)
created_at      timestamptz
```

### Table: `telemetry_segments`
60-second behavioural segments extracted from raw telemetry.
```
id                  uuid  PK default gen_random_uuid()
trip_id             uuid  FK → trips(id)
segment_index       int         -- 0-based segment number within trip
started_at          timestamptz
ended_at            timestamptz
avg_speed_kmh       float
speed_variance      float
accel_variance      float       -- m/s² — most predictive feature (r=0.82)
braking_frequency   float       -- events/km  (r=0.76)
idle_time_pct       float       -- % of segment spent idle
energy_kwh          float       -- FASTSim for this segment
xgboost_efficiency_label text   -- 'optimal' | 'suboptimal'
shap_top_feature    text        -- most impactful feature for explainability
created_at          timestamptz
```

### Table: `raw_telemetry`
1 Hz GPS + motion data points (high-volume, consider partitioning).
```
id          bigserial  PK
trip_id     uuid  FK → trips(id)
recorded_at timestamptz
lat         float
lng         float
speed_ms    float
accel_ms2   float
altitude_m  float
heading_deg float
```

### Table: `route_comparisons`
Post-trip alternative route analysis.
```
id                  uuid  PK default gen_random_uuid()
trip_id             uuid  FK → trips(id)
route_label         text    -- 'taken' | 'alt_1' | 'alt_2'
distance_km         float
estimated_energy_kwh float  -- FASTSim prediction
estimated_co2_kg    float
elevation_gain_m    float
route_polyline      text
created_at          timestamptz
```

### Table: `feedback_events`
In-app behavioural nudge log.
```
id              uuid  PK default gen_random_uuid()
trip_id         uuid  FK → trips(id)
segment_id      uuid  FK → telemetry_segments(id)  nullable
event_type      text  -- 'harsh_accel' | 'harsh_brake' | 'idling' | 'speed_variance'
message         text
triggered_at    timestamptz
acknowledged    boolean default false
```

---

## Emission Conversion Factors (IPCC)

Use these in computed columns or application logic:
- **LPG**: 69,300 kg CO2/TJ → 0.2496 kg CO2/kWh
- **Diesel**: 74,100 kg CO2/TJ → 0.2668 kg CO2/kWh
- **Petrol**: 69,300 kg CO2/TJ → 0.2496 kg CO2/kWh
- **EV**: use grid intensity factor (Malaysia ~0.585 kg CO2/kWh, TNB 2023)

---

## Supabase Auth Requirements

- Enable **Email/Password** sign-up
- Enable **email confirmation** (optional for dev, required for prod)
- Auto-create `profiles` row on user sign-up using a **database trigger** on `auth.users`
- RLS: users can only read/write their own data

### Auth Trigger (create profile on signup)
```sql
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, new.raw_user_meta_data->>'display_name');
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
```

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

Apply equivalent policies to: `profiles`, `telemetry_segments`, `raw_telemetry`, `route_comparisons`, `feedback_events`.

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
| Mobile client | Flutter or React Native (consumes this backend) |
| Maps | Google Maps Platform API (routes stored here, computed externally) |

### Separate ML Repo (not built here — for context only)
| Layer | Technology |
|-------|-----------|
| Simulation | FASTSim (NREL Python library) |
| Behaviour model | XGBoost + SHAP (Python, scikit-learn pipeline) |
| Runtime | Python service that reads telemetry and writes results back to this backend |

---

## Folder Structure (Follow This Exactly)

Based on the standard Node.js + Express architecture. Use `module-alias` for `@routes`, `@controllers` etc. path aliases.

```
/
├── app/
│   ├── config/
│   │   ├── app.conf.js          # App-level config (port, env, CORS origins)
│   │   ├── db.conf.js           # Supabase connection config
│   │   ├── app.keys.js          # Supabase keys, Google Maps key (loaded from .env)
│   │   └── init.js              # Exports all config together
│   │
│   ├── database/
│   │   ├── Supabase.database.js # Supabase client singleton (anon + service role)
│   │   └── init.js
│   │
│   ├── routes/
│   │   ├── Auth.routes.js       # POST /auth/signup, /auth/signin, /auth/signout
│   │   ├── Trip.routes.js       # CRUD for trips
│   │   ├── Telemetry.routes.js  # Bulk insert raw_telemetry
│   │   ├── Segment.routes.js    # Read telemetry_segments (written by ML repo)
│   │   ├── Route.routes.js      # Read route_comparisons
│   │   ├── Feedback.routes.js   # feedback_events CRUD
│   │   ├── Ml.routes.js         # ML repo writeback endpoints (service-role protected)
│   │   └── init.js              # Mounts all routers onto Express app
│   │
│   ├── controllers/
│   │   ├── Auth.controller.js
│   │   ├── Trip.controller.js
│   │   ├── Telemetry.controller.js
│   │   ├── Segment.controller.js
│   │   ├── Route.controller.js
│   │   ├── Feedback.controller.js
│   │   └── Ml.controller.js     # Handles ML repo writebacks
│   │
│   ├── middleware/
│   │   ├── Auth.middleware.js        # Validate Supabase JWT from Authorization header
│   │   ├── ServiceRole.middleware.js # Validate ML repo service-role key
│   │   ├── ErrorHandler.middleware.js
│   │   ├── Validate.middleware.js    # Request body validation (e.g. express-validator)
│   │   └── init.js
│   │
│   ├── helpers/
│   │   ├── Supabase.helper.js   # Shared Supabase query helpers
│   │   ├── Emission.helper.js   # CO2 conversion factor lookups (IPCC constants)
│   │   └── Response.helper.js   # Standardised API response shape {success, data, error}
│   │
│   └── utils/
│       └── Logger.util.js       # Winston or pino logger
│
├── supabase/
│   └── migrations/
│       └── 001_initial_schema.sql  # All tables, indexes, RLS, auth trigger
│
├── samples/
│   ├── .env.sample
│   ├── app.conf.sample
│   └── app.keys.sample
│
├── node_modules/
├── server.js        # Entry point — creates Express app, loads middleware, starts server
├── package.json
├── .env             # Never commit — see samples/
└── .gitignore
```

### Key Conventions
- All `init.js` files aggregate and export their folder's modules so consumers need one `require`
- Controllers are thin — business logic goes in helpers
- `Ml.routes.js` is the dedicated surface for the ML repo to write back results; it uses `ServiceRole.middleware.js` not the user JWT middleware
- `Emission.helper.js` holds the IPCC conversion constants (do not scatter these across controllers)
- Always return a consistent response shape: `{ success: true, data: {...} }` or `{ success: false, error: "message" }`

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

# The ML repo will use this service role key to write back computed results
# No ML model paths belong in this repo
```

---

## Key Business Rules

1. A `trip` is only saved after it ends (not during)
2. `telemetry_segments` rows are written by the **ML repo** after it processes raw telemetry — this backend just stores them
3. `driver_profile` on a trip is sent by the ML repo after classification — this backend does not compute it
4. `energy_kwh` and `co2_kg` on trips and segments are written by the ML repo — this backend stores and serves them
5. `co2_kg` reference: LPG 0.2496 kg/kWh, Diesel 0.2668 kg/kWh, EV ~0.585 kg/kWh (Malaysia grid)
6. Route comparison data is written by the ML repo after it runs FASTSim on alternatives — this backend stores and serves it
7. Route comparison runs async after trip save — the mobile app should poll or use Supabase Realtime to detect when results are ready
8. `raw_telemetry` may be pruned after 30 days (retain aggregated segment data permanently)
9. The ML repo authenticates to this backend using the **Supabase service role key**

---

## Immediate Tasks (Priority Order)

1. **Discuss and agree on database schema** — present all tables, get approval before writing SQL
2. **Write Supabase migration SQL** — all tables, indexes, RLS, auth trigger (`supabase/migrations/001_initial_schema.sql`)
3. **Supabase client setup** — typed TypeScript client auto-generated from schema
4. **Auth flow** — sign-up, sign-in, session refresh, profile auto-creation via trigger
5. **Trip CRUD endpoints** — POST /trips, GET /trips, GET /trips/:id (mobile app)
6. **Telemetry ingestion endpoint** — bulk insert `raw_telemetry` from mobile app
7. **ML writeback endpoints** — authenticated endpoints for the ML repo to POST segment results, update trip energy/CO2/profile, and insert route comparisons
8. **Feedback events endpoint** — store and retrieve in-app behavioural nudges