# EcoRoute — ML Service Context

This document describes the backend system that the ML service integrates with. Use it to understand the data flow, what the backend expects from the ML service, and what the database looks like.

---

## System Overview

The EcoRoute backend is a Node.js + Express API backed by Supabase (PostgreSQL). The mobile app (Flutter/React Native) collects 1 Hz GPS + accelerometer telemetry during trips and sends it to this backend. The backend then calls the ML service to compute energy usage, CO2 emissions, and driving behaviour classification.

```
Mobile App
  │
  ├── POST /api/telemetry  →  Backend stores raw points
  │                               └── calls ML: POST /analyse/segment  (real-time, every ~60s)
  │                                       └── Backend stores segment + generates feedback nudge
  │
  └── PATCH /api/trips/:id/end  →  Backend marks trip ended
                                        └── calls ML: POST /analyse/trip     (post-trip summary)
                                        └── calls ML: POST /analyse/routes   (route comparisons)
```

The ML service is a **passive HTTP server** — it does not call the backend. The backend calls the ML service and writes the results itself.

---

## ML Service Endpoints the Backend Calls

The backend assumes the ML service exposes these three endpoints. All are `POST`, `Content-Type: application/json`.

---

### 1. `POST /analyse/segment`

Called **during** an active trip after each telemetry batch (every time the mobile app posts GPS points). The ML service should accumulate points across calls per `trip_id` until it has a full 60-second window, then return a segment. Return `null` for the segment if the window is not yet complete.

**Request body:**
```json
{
  "trip_id": "uuid",
  "points": [
    {
      "recorded_at": "2024-01-15T08:30:00.000Z",
      "lat": 3.1412,
      "lng": 101.6865,
      "speed_ms": 13.8,
      "accel_ms2": 0.5,
      "altitude_m": 45.2,
      "heading_deg": 270.0
    }
  ]
}
```

**Response — window not yet complete (less than 60s of data):**
```json
{
  "segment": null
}
```

**Response — 60s window complete:**
```json
{
  "segment": {
    "segment_index": 0,
    "started_at": "2024-01-15T08:30:00.000Z",
    "ended_at": "2024-01-15T08:31:00.000Z",
    "avg_speed_kmh": 49.7,
    "speed_variance": 12.3,
    "accel_variance": 0.82,
    "braking_frequency": 1.4,
    "idle_time_pct": 5.2,
    "energy_kwh": 0.043,
    "xgboost_efficiency_label": "suboptimal",
    "shap_top_feature": "accel_variance"
  }
}
```

**Field definitions:**

| Field | Type | Description |
|---|---|---|
| `segment_index` | int | 0-based segment number within this trip |
| `started_at` | ISO 8601 | Timestamp of first point in this window |
| `ended_at` | ISO 8601 | Timestamp of last point in this window |
| `avg_speed_kmh` | float | Mean speed over the 60s window |
| `speed_variance` | float | Variance of speed (km/h²) |
| `accel_variance` | float | Variance of acceleration (m/s²) — most predictive feature (r=0.82) |
| `braking_frequency` | float | Braking events per km (r=0.76) |
| `idle_time_pct` | float | % of window where speed < threshold |
| `energy_kwh` | float | FASTSim energy consumption for this segment |
| `xgboost_efficiency_label` | string | `"optimal"` or `"suboptimal"` |
| `shap_top_feature` | string | Most impactful SHAP feature — one of: `accel_variance`, `braking_frequency`, `idle_time_pct`, `speed_variance` |

**How the backend uses this response:**
- Stores the segment in `telemetry_segments`
- If `xgboost_efficiency_label == "suboptimal"`, auto-generates a `feedback_events` row using the `shap_top_feature` mapping below

**SHAP feature → feedback event type mapping:**
| `shap_top_feature` | `event_type` |
|---|---|
| `accel_variance` | `harsh_accel` |
| `braking_frequency` | `harsh_brake` |
| `idle_time_pct` | `idling` |
| `speed_variance` | `speed_variance` |

---

### 2. `POST /analyse/trip`

Called **once** after a trip ends. The ML service should aggregate all segments already computed for this trip and produce trip-level energy, CO2, driver profile, and efficiency.

**Request body:**
```json
{
  "trip_id": "uuid",
  "fuel_type": "petrol",
  "distance_km": 12.4,
  "duration_sec": 1380
}
```

`fuel_type` is one of: `petrol`, `diesel`, `lpg`, `ev`, `hybrid`

**Response:**
```json
{
  "energy_kwh": 1.87,
  "co2_kg": 0.467,
  "driver_profile": "normal",
  "excess_vs_optimal_pct": 14.2
}
```

**Field definitions:**

| Field | Type | Description |
|---|---|---|
| `energy_kwh` | float | Total FASTSim energy for the trip |
| `co2_kg` | float | CO2 in kg using IPCC conversion factors (see below) |
| `driver_profile` | string | XGBoost classification: `"smooth"`, `"normal"`, or `"aggressive"` |
| `excess_vs_optimal_pct` | float | `(actual - optimal) / optimal * 100` — how much more energy was used vs optimal driving |

**CO2 conversion factors (IPCC):**
| Fuel type | Factor |
|---|---|
| Petrol | 0.2496 kg CO2/kWh |
| LPG | 0.2496 kg CO2/kWh |
| Diesel | 0.2668 kg CO2/kWh |
| EV | 0.585 kg CO2/kWh (Malaysia TNB grid 2023) |
| Hybrid | Use petrol factor unless otherwise specified |

**How the backend uses this response:**
- Updates the `trips` row with `energy_kwh`, `co2_kg`, `driver_profile`, `excess_vs_optimal_pct`

---

### 3. `POST /analyse/routes`

Called **once** after a trip ends. The ML service should run FASTSim on alternative routes to estimate what energy and CO2 each route would have cost.

**Request body:**
```json
{
  "trip_id": "uuid",
  "origin_lat": 3.1412,
  "origin_lng": 101.6865,
  "dest_lat": 3.0700,
  "dest_lng": 101.5910,
  "fuel_type": "petrol"
}
```

The ML service is responsible for fetching alternative routes (e.g. via Mapbox or Google Maps) and running FASTSim on each.

**Response:**
```json
[
  {
    "route_label": "taken",
    "distance_km": 12.4,
    "estimated_energy_kwh": 1.87,
    "estimated_co2_kg": 0.467,
    "elevation_gain_m": 32.0,
    "route_polyline": "encoded_polyline_string"
  },
  {
    "route_label": "alt_1",
    "distance_km": 11.1,
    "estimated_energy_kwh": 1.54,
    "estimated_co2_kg": 0.384,
    "elevation_gain_m": 18.5,
    "route_polyline": "encoded_polyline_string"
  },
  {
    "route_label": "alt_2",
    "distance_km": 13.8,
    "estimated_energy_kwh": 2.01,
    "estimated_co2_kg": 0.502,
    "elevation_gain_m": 55.0,
    "route_polyline": "encoded_polyline_string"
  }
]
```

`route_label` must be one of: `taken`, `alt_1`, `alt_2`

**How the backend uses this response:**
- Inserts each item as a row in `route_comparisons` linked to the `trip_id`

---

## Database Schema

All tables are in the `public` schema on Supabase (PostgreSQL 15). The ML service reads from `raw_telemetry` and writes to `telemetry_segments`, `trips` (ML fields only), and `route_comparisons` — but via the backend HTTP API, not direct DB access.

### `users`
```
id             uuid        PK  (mirrors auth.users)
email          text
display_name   text
avatar_url     text
role           text        'user' | 'admin'
account_status text        'active' | 'suspended' | 'deleted'
created_at     timestamptz
updated_at     timestamptz
```

### `vehicles`
```
id               uuid        PK
user_id          uuid        FK → users(id)
label            text
make             text        e.g. "Toyota"
model            text        e.g. "Corolla"
year             int         e.g. 2021
vehicle_type     text        'petrol' | 'diesel' | 'lpg' | 'ev' | 'hybrid'
vehicle_mass_kg  float8      FASTSim parameter
drag_coefficient float8      FASTSim parameter
drivetrain_type  text        'fwd' | 'rwd' | 'awd'
is_default       boolean
created_at       timestamptz
updated_at       timestamptz
```

### `trips`
```
id                    uuid        PK
user_id               uuid        FK → users(id)
vehicle_id            uuid        FK → vehicles(id)
status                text        'active' | 'ended' | 'cancelled'
started_at            timestamptz
ended_at              timestamptz (null while active)
distance_km           float8      (null while active)
duration_sec          int         (null while active)
route_polyline        text        encoded polyline of taken route
origin_lat            float8
origin_lng            float8
origin_address        text
dest_lat              float8
dest_lng              float8
dest_address          text
fuel_type             text        'petrol' | 'diesel' | 'lpg' | 'ev' | 'hybrid'

-- Fields written by ML service (via backend) after trip ends:
energy_kwh            float8
co2_kg                float8
excess_vs_optimal_pct float8
driver_profile        text        'smooth' | 'normal' | 'aggressive'

created_at            timestamptz
```

### `raw_telemetry`
```
id          bigserial   PK
trip_id     uuid        FK → trips(id)
recorded_at timestamptz
lat         float8
lng         float8
speed_ms    float8      speed in m/s
accel_ms2   float8      acceleration in m/s²
altitude_m  float8
heading_deg float8      0–360
```
> Pruned after 30 days. Retain aggregated segment data permanently.

### `telemetry_segments`
Written by the backend after ML service returns a completed 60s window.
```
id                       uuid        PK
trip_id                  uuid        FK → trips(id)
segment_index            int         0-based within trip
started_at               timestamptz
ended_at                 timestamptz
avg_speed_kmh            float8
speed_variance           float8
accel_variance           float8
braking_frequency        float8      events/km
idle_time_pct            float8      %
energy_kwh               float8      FASTSim for this window
xgboost_efficiency_label text        'optimal' | 'suboptimal'
shap_top_feature         text        most impactful feature name
created_at               timestamptz
```

### `route_comparisons`
Written by the backend after ML service returns route analysis.
```
id                   uuid        PK
trip_id              uuid        FK → trips(id)
route_label          text        'taken' | 'alt_1' | 'alt_2'
distance_km          float8
estimated_energy_kwh float8
estimated_co2_kg     float8
elevation_gain_m     float8
route_polyline       text
created_at           timestamptz
```

### `feedback_events`
Auto-generated by the backend — no ML involvement needed.
```
id           uuid        PK
trip_id      uuid        FK → trips(id)
segment_id   uuid        FK → telemetry_segments(id)
event_type   text        'harsh_accel' | 'harsh_brake' | 'idling' | 'speed_variance'
message      text
triggered_at timestamptz
acknowledged boolean
```

---

## Full Trip Lifecycle

```
1. User selects destination
   POST /api/routes/search → returns route options (Mapbox)

2. User starts trip
   POST /api/trips
   → trip created with status = 'active'

3. During trip (~every few seconds)
   POST /api/telemetry  { trip_id, points: [...] }
   → backend stores raw points
   → backend calls ML: POST /analyse/segment
       → if window complete: backend stores segment, generates feedback nudge
       → if window incomplete: nothing stored yet

4. User ends trip
   PATCH /api/trips/:id/end  { ended_at, distance_km, duration_sec }
   → trip status set to 'ended'
   → backend calls ML async: POST /analyse/trip
       → backend writes energy_kwh, co2_kg, driver_profile, excess_vs_optimal_pct to trips
   → backend calls ML async: POST /analyse/routes
       → backend writes route_comparisons rows

5. Post-trip (mobile app reads results)
   GET /api/segments/trip/:tripId       → list of 60s segments
   GET /api/feedback/trip/:tripId       → list of nudges
   GET /api/routes/trip/:tripId         → route comparison results
   GET /api/trips/:id                   → trip summary with ML fields
```

---

## Key Business Rules

- A trip is `active` from creation until `PATCH /:id/end` is called. Telemetry is only accepted for active trips.
- The ML service must track per-`trip_id` telemetry state across multiple `/analyse/segment` calls to know when a 60s window is complete.
- `segment_index` should be 0-based and monotonically increasing per trip.
- `driver_profile` is derived from the majority class across all segments' `xgboost_efficiency_label` values (or a weighted aggregate — your choice).
- `excess_vs_optimal_pct = (actual_energy - optimal_energy) / optimal_energy * 100`. Optimal energy is what a smooth driver would consume on the same route.
- ML calls from the backend are fire-and-forget (async). The mobile app polls or uses Supabase Realtime to detect when results are available.
- If the ML service is unavailable, the backend logs the error and continues — the trip is saved but ML fields remain null.

---

## Environment

The backend sets `ML_SERVICE_URL` in its environment (default `http://localhost:8000` for local dev). The ML service should run on this URL and expose the three endpoints above. No authentication is required between backend and ML service on the local network — add a shared secret header if deploying to production.
