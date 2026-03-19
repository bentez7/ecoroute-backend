# EcoRoute Backend

Supabase + Express backend for the **Carbon Aware Route Planner** — a behaviour-aware carbon tracking mobile app that combines FASTSim energy simulation, XGBoost driving behaviour classification, and Google Maps route comparison to help drivers reduce emissions.

---

## Architecture

```
Mobile App (Flutter / React Native)
    │
    ├── Streams raw GPS + motion telemetry (0.5 Hz)
    ├── POSTs trip data and telemetry to this backend
    │
    ▼
EcoRoute Backend (this repo)
    ├── Supabase Auth (email/password)
    ├── PostgreSQL database + RLS
    └── REST API
            │
            ▼
    ML Repo (separate)
    ├── FASTSim — energy & CO2 simulation
    ├── XGBoost + SHAP — driving behaviour classification
    └── POSTs computed results back to this backend
```

The ML repo is a separate service. It receives telemetry, computes results, and writes back to this backend via service-role-protected endpoints. It has no direct database access.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Runtime | Node.js |
| Framework | Express.js |
| Language | JavaScript (CommonJS) |
| Database | Supabase (PostgreSQL 15) |
| Auth | Supabase Auth |
| Path aliases | module-alias |

---

## Project Structure

```
app/
├── config/          # App config, keys, Supabase connection config
├── database/        # Supabase client singletons (anon + service role) + models
├── controllers/     # Thin request handlers — delegate to services
├── services/        # Business logic and database operations per resource
├── routes/          # Express routers with middleware guards
├── middleware/       # Auth JWT, service role, error handler, validation
├── helpers/         # Response shape, CO2 emission factors
└── utils/           # Winston logger
supabase/
└── migrations/      # SQL schema, RLS policies, indexes, triggers
samples/
└── .env.sample      # Environment variable template
server.js            # Entry point
```

---

## Database Schema

| Table | Written by | Purpose |
|---|---|---|
| `users` | Auth trigger | User profiles — extends Supabase auth.users |
| `vehicles` | Mobile app | User-owned vehicles with FASTSim parameters |
| `trips` | Mobile app + ML repo | One row per completed trip |
| `raw_telemetry` | Mobile app | 0.5 Hz GPS + motion stream, pruned after 30 days |
| `telemetry_segments` | ML repo | 60-second behavioural windows with XGBoost labels |
| `route_comparisons` | ML repo | FASTSim analysis of alternative routes |
| `feedback_events` | Backend (auto) | Behavioural nudges from suboptimal driving segments |

---

## API Endpoints

### Auth
| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/api/auth/signup` | — | Register with email + password |
| POST | `/api/auth/signin` | — | Sign in, returns session tokens |
| POST | `/api/auth/signout` | JWT | Revoke session |
| GET | `/api/auth/me` | JWT | Get current user profile |

### Vehicles
| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/api/vehicles` | JWT | Add a vehicle |
| GET | `/api/vehicles` | JWT | List user's vehicles |
| PATCH | `/api/vehicles/:id` | JWT | Update vehicle |
| DELETE | `/api/vehicles/:id` | JWT | Delete vehicle |

### Trips
| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/api/trips` | JWT | Create a trip |
| GET | `/api/trips` | JWT | List user's trips |
| GET | `/api/trips/:id` | JWT | Get a trip |
| PATCH | `/api/trips/:id` | JWT | Update a trip |

### Telemetry
| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/api/telemetry` | JWT | Bulk insert raw telemetry points |
| GET | `/api/telemetry/trip/:tripId` | JWT | Get telemetry for a trip |

### Segments, Routes, Feedback
| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/api/segments/trip/:tripId` | JWT | Get segments for a trip |
| GET | `/api/segments/:id` | JWT | Get a segment |
| GET | `/api/routes/trip/:tripId` | JWT | Get route comparisons for a trip |
| GET | `/api/feedback/trip/:tripId` | JWT | Get feedback events for a trip |
| PATCH | `/api/feedback/:id/acknowledge` | JWT | Acknowledge a feedback nudge |

### ML Writeback (service role key required)
| Method | Path | Description |
|---|---|---|
| PATCH | `/api/ml/trips/:tripId/results` | Write energy, CO2, driver profile |
| POST | `/api/ml/trips/:tripId/segments` | Write telemetry segments |
| POST | `/api/ml/trips/:tripId/routes` | Write route comparisons |

### Health
| Method | Path | Description |
|---|---|---|
| GET | `/health` | Server health check |

---

## API Documentation (Swagger UI)

The interactive API documentation is served via Swagger UI. Once the server is running, open:

```
http://localhost:3000/api-docs
```

You can browse all endpoints, view request/response schemas, and test the API directly from the browser.

### How to authenticate in Swagger UI

Most endpoints require a Supabase JWT. To test them:

1. Call `POST /api/auth/signin` in Swagger UI (no auth required) and copy the `access_token` from the response
2. Click the **Authorize** button at the top of the Swagger page
3. Paste the token into the **bearerAuth** field (do not include the word "Bearer" — Swagger adds it automatically)
4. Click **Authorize** → all subsequent requests will include the token

For ML writeback endpoints, use the **serviceRoleKey** field and paste your `SUPABASE_SERVICE_ROLE_KEY` value.

---

## Getting Started

### Prerequisites
- Node.js 18+
- A Supabase project with the migration applied

### Setup

```bash
# Install dependencies
npm install

# Copy env template and fill in your values
cp samples/.env.sample .env
```

### Environment Variables

```env
SUPABASE_URL=https://<project-ref>.supabase.co
SUPABASE_ANON_KEY=<anon-public-key>
SUPABASE_SERVICE_ROLE_KEY=<service-role-secret-key>
GOOGLE_MAPS_API_KEY=<your-maps-api-key>
PORT=3000
NODE_ENV=development
CORS_ORIGINS=http://localhost:3000
```

### Run

```bash
# Development (with auto-reload)
npm run dev

# Production
npm start
```

---

## Database Migration

The full schema is in `supabase/migrations/001_initial_schema.sql`. It includes all tables, indexes, RLS policies, and the `handle_new_user` trigger that auto-creates a `public.users` profile on signup.

Apply it via the Supabase dashboard or CLI:

```bash
supabase db push
```
