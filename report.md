# EcoRoute Backend API Documentation

**Version:** 1.1.0
**Last Updated:** 2026-04-15
**Base URL:** `/api`

---

## 1. Overview

EcoRoute is a behaviour-aware carbon tracking platform that combines physics-based vehicle simulation (FASTSim) with machine learning (XGBoost + SHAP) to help drivers reduce emissions by 15-25%. This backend provides the REST API that the mobile app and ML service consume.

### Base URLs

| Environment | Base URL |
|-------------|----------|
| Development | `http://localhost:3000/api` |
| Staging | `https://staging-api.ecoroute.app/api` |
| Production | `https://api.ecoroute.app/api` |

### API Versioning

The API currently does **not** use versioned paths (no `/v1/` prefix). All endpoints are served under `/api/`. Breaking changes will be communicated in the changelog below. A versioned prefix will be introduced before the first public release.

### Rate Limiting

No rate limiting is enforced at the application layer. Rate limits may be applied at the infrastructure level (Supabase, reverse proxy). The `raw_telemetry` bulk insert endpoint should be called at most once per second per trip.

### Health Check

```
GET /health
```

Returns `{ "success": true, "data": { "status": "ok" } }` with HTTP 200 if the server is running.

---

## 2. Authentication & Authorization

### Authentication Method

All protected endpoints require a **Supabase JWT** passed as a Bearer token in the `Authorization` header.

```
Authorization: Bearer <access_token>
```

### How to Obtain a Token

1. **Sign up** via `POST /api/auth/signup` — returns an `access_token` on success.
2. **Sign in** via `POST /api/auth/signin` — returns an `access_token` on success.
3. Store the `access_token` and attach it to every subsequent request.

### Token Expiration & Refresh

Supabase JWTs expire after **1 hour** by default. The `expires_at` field (Unix epoch in seconds) is returned in the session object. Use the Supabase client SDK's built-in `onAuthStateChange` listener or `getSession()` to handle automatic token refresh — the SDK stores a refresh token and renews the access token transparently.

If you are using raw HTTP calls without the SDK, catch **401 responses** and call `supabase.auth.refreshSession()` or re-authenticate.

### Role-Based Access

| Role | Description |
|------|-------------|
| `user` | Default role. Can access own data only. |
| `service_role` | ML service. Uses the Supabase service role key (server-to-server only). |

All user-facing endpoints enforce **ownership checks** — a user can only read/write their own trips, vehicles, telemetry, etc. RLS policies are enforced at the database level as a second layer of protection.

---

## 3. Global Headers & Conventions

### Required Headers

| Header | Value | Required |
|--------|-------|----------|
| `Content-Type` | `application/json` | Yes (for POST/PATCH/PUT) |
| `Authorization` | `Bearer <access_token>` | Yes (for protected endpoints) |
| `Accept` | `application/json` | Recommended |

### Pagination

Pagination is **offset-based** and used by the vehicle catalog endpoints (`/makes`, `/models`, `/variants`).

| Parameter | Type | Default | Max | Description |
|-----------|------|---------|-----|-------------|
| `page` | number | `1` | - | 1-indexed page number |
| `limit` | number | `20` | `100` | Items per page |

Paginated responses include a `pagination` object:

```json
{
  "success": true,
  "data": {
    "data": ["Toyota", "Honda", "..."],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 58,
      "total_pages": 3
    }
  }
}
```

### Date/Time Format

All timestamps are **ISO 8601 in UTC**: `2026-04-09T14:30:00.000Z`

### Universal Response Shape

**Success:**

```json
{
  "success": true,
  "data": { ... }
}
```

**Error:**

```json
{
  "success": false,
  "error": "Human-readable error message"
}
```

**Validation Error (422):**

```json
{
  "success": false,
  "error": [
    {
      "type": "field",
      "value": "",
      "msg": "Valid email required",
      "path": "email",
      "location": "body"
    }
  ]
}
```

---

## 4. Endpoints

### 4.1 Authentication

---

#### POST /api/auth/signup

**Description:** Register a new user account. A `users` profile row is auto-created via database trigger.

**Auth required:** No

**Request Body:**

| Field | Type | Required | Validation | Description |
|-------|------|----------|------------|-------------|
| `email` | string | Yes | Valid email format | User's email address |
| `password` | string | Yes | Min 6 characters | Account password |
| `display_name` | string | No | Non-blank if provided | Display name shown in-app |

**Example Request Body:**

```json
{
  "email": "driver@example.com",
  "password": "securePass123",
  "display_name": "Alex"
}
```

**Success Response:** `201 Created`

```json
{
  "success": true,
  "data": {
    "user": {
      "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
      "email": "driver@example.com",
      "display_name": "Alex"
    },
    "session": {
      "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
      "expires_at": 1744208400
    }
  }
}
```

**Error Responses:**

| Status | Error | Description |
|--------|-------|-------------|
| 400 | `"User already registered"` | Email already in use |
| 422 | `[{ "msg": "Valid email required", ... }]` | Validation failed |

**cURL Example:**

```bash
curl -X POST http://localhost:3000/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{
    "email": "driver@example.com",
    "password": "securePass123",
    "display_name": "Alex"
  }'
```

---

#### POST /api/auth/signin

**Description:** Authenticate an existing user with email and password.

**Auth required:** No

**Request Body:**

| Field | Type | Required | Validation | Description |
|-------|------|----------|------------|-------------|
| `email` | string | Yes | Valid email format | User's email address |
| `password` | string | Yes | Non-empty | Account password |

**Example Request Body:**

```json
{
  "email": "driver@example.com",
  "password": "securePass123"
}
```

**Success Response:** `200 OK`

```json
{
  "success": true,
  "data": {
    "user": {
      "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
      "email": "driver@example.com",
      "display_name": "Alex"
    },
    "session": {
      "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
      "expires_at": 1744208400
    }
  }
}
```

**Error Responses:**

| Status | Error | Description |
|--------|-------|-------------|
| 401 | `"Invalid login credentials"` | Wrong email or password |
| 422 | `[{ "msg": "...", ... }]` | Validation failed |

**cURL Example:**

```bash
curl -X POST http://localhost:3000/api/auth/signin \
  -H "Content-Type: application/json" \
  -d '{
    "email": "driver@example.com",
    "password": "securePass123"
  }'
```

---

#### POST /api/auth/signout

**Description:** Sign out the current user and invalidate their session.

**Auth required:** Yes

**Success Response:** `200 OK`

```json
{
  "success": true,
  "data": {
    "message": "Signed out successfully"
  }
}
```

**Error Responses:**

| Status | Error | Description |
|--------|-------|-------------|
| 400 | `"..."` | Signout failed (e.g. already signed out) |
| 401 | `"Missing or malformed Authorization header"` | No token provided |
| 401 | `"Invalid or expired token"` | Token is invalid |

**cURL Example:**

```bash
curl -X POST http://localhost:3000/api/auth/signout \
  -H "Authorization: Bearer eyJhbGciOi..."
```

---

#### GET /api/auth/me

**Description:** Get the authenticated user's profile from the `users` table.

**Auth required:** Yes

**Success Response:** `200 OK`

```json
{
  "success": true,
  "data": {
    "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "email": "driver@example.com",
    "display_name": "Alex",
    "avatar_url": null,
    "role": "user",
    "account_status": "active",
    "created_at": "2026-04-01T10:00:00.000Z",
    "updated_at": "2026-04-01T10:00:00.000Z"
  }
}
```

**Error Responses:**

| Status | Error | Description |
|--------|-------|-------------|
| 401 | `"Missing or malformed Authorization header"` | No token |
| 401 | `"Invalid or expired token"` | Token is invalid |
| 404 | `"..."` | User profile not found |

**cURL Example:**

```bash
curl http://localhost:3000/api/auth/me \
  -H "Authorization: Bearer eyJhbGciOi..."
```

---

### 4.2 Vehicles

---

#### GET /api/vehicles/makes

**Description:** List all available vehicle makes. Public endpoint for vehicle selection UI.

**Auth required:** No

**Query Parameters:**

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `page` | number | No | `1` | Page number |
| `limit` | number | No | `20` | Items per page (max 100) |

**Success Response:** `200 OK`

```json
{
  "success": true,
  "data": {
    "data": ["Toyota", "Honda", "BMW", "Tesla"],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 58,
      "total_pages": 3
    }
  }
}
```

**cURL Example:**

```bash
curl "http://localhost:3000/api/vehicles/makes?page=1&limit=10"
```

---

#### GET /api/vehicles/makes/:make/models

**Description:** List all models for a given vehicle make.

**Auth required:** No

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `make` | string | Vehicle make name (case-insensitive) |

**Query Parameters:**

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `page` | number | No | `1` | Page number |
| `limit` | number | No | `20` | Items per page (max 100) |

**Success Response:** `200 OK`

```json
{
  "success": true,
  "data": {
    "data": ["Corolla", "Camry", "RAV4", "Hilux"],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 12,
      "total_pages": 1
    }
  }
}
```

**Error Responses:**

| Status | Error | Description |
|--------|-------|-------------|
| 404 | `"Make not found"` | The specified make does not exist |

**cURL Example:**

```bash
curl "http://localhost:3000/api/vehicles/makes/Toyota/models"
```

---

#### GET /api/vehicles/makes/:make/models/:model/variants

**Description:** List all variants for a given make and model. Returns objects with vehicle specs.

**Auth required:** No

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `make` | string | Vehicle make name (case-insensitive) |
| `model` | string | Vehicle model name (case-insensitive) |

**Query Parameters:**

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `page` | number | No | `1` | Page number |
| `limit` | number | No | `20` | Items per page (max 100) |

**Success Response:** `200 OK`

```json
{
  "success": true,
  "data": {
    "data": [
      {
        "variant": "1.8L CVT",
        "year": 2024,
        "vehicle_type": "petrol",
        "vehicle_mass_kg": 1350,
        "drag_coefficient": 0.29,
        "drivetrain_type": "fwd"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 3,
      "total_pages": 1
    }
  }
}
```

**Error Responses:**

| Status | Error | Description |
|--------|-------|-------------|
| 404 | `"Make not found"` | The specified make does not exist |
| 404 | `"Model not found"` | The specified model does not exist under this make |

**cURL Example:**

```bash
curl "http://localhost:3000/api/vehicles/makes/Toyota/models/Corolla/variants"
```

---

#### POST /api/vehicles

**Description:** Add a vehicle to the authenticated user's garage. The first vehicle added is automatically set as default.

**Auth required:** Yes

**Request Body:**

| Field | Type | Required | Validation | Description |
|-------|------|----------|------------|-------------|
| `make` | string | Yes | Max 100 chars, non-empty | Manufacturer name |
| `model` | string | Yes | Max 100 chars, non-empty | Model name |
| `year` | number | No | Integer 1900-2100 | Model year |
| `vehicle_type` | string (enum) | Yes | `petrol` \| `diesel` \| `lpg` \| `ev` \| `hybrid` | Fuel/powertrain type |
| `vehicle_mass_kg` | number | No | Float 500-10000 | Kerb weight in kg |
| `drag_coefficient` | number | No | Float 0.1-1.0 | Aerodynamic drag coefficient |
| `drivetrain_type` | string (enum) | Yes | `fwd` \| `rwd` \| `awd` | Drivetrain layout |

**Example Request Body:**

```json
{
  "make": "Toyota",
  "model": "Corolla",
  "year": 2024,
  "vehicle_type": "petrol",
  "vehicle_mass_kg": 1350,
  "drag_coefficient": 0.29,
  "drivetrain_type": "fwd"
}
```

**Success Response:** `201 Created`

```json
{
  "success": true,
  "data": {
    "id": "b2c3d4e5-f6a7-8901-bcde-f12345678901",
    "make": "Toyota",
    "model": "Corolla",
    "year": 2024,
    "vehicle_type": "petrol",
    "vehicle_mass_kg": 1350,
    "drag_coefficient": 0.29,
    "drivetrain_type": "fwd",
    "is_default": true,
    "created_at": "2026-04-09T10:00:00.000Z",
    "updated_at": "2026-04-09T10:00:00.000Z"
  }
}
```

**Error Responses:**

| Status | Error | Description |
|--------|-------|-------------|
| 400 | `"..."` | Database insertion error |
| 401 | `"Invalid or expired token"` | Authentication failed |
| 422 | `[{ "msg": "...", ... }]` | Validation failed |

**cURL Example:**

```bash
curl -X POST http://localhost:3000/api/vehicles \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer eyJhbGciOi..." \
  -d '{
    "make": "Toyota",
    "model": "Corolla",
    "year": 2024,
    "vehicle_type": "petrol",
    "vehicle_mass_kg": 1350,
    "drag_coefficient": 0.29,
    "drivetrain_type": "fwd"
  }'
```

---

#### GET /api/vehicles

**Description:** List all vehicles belonging to the authenticated user.

**Auth required:** Yes

**Success Response:** `200 OK`

```json
{
  "success": true,
  "data": [
    {
      "id": "b2c3d4e5-f6a7-8901-bcde-f12345678901",
      "make": "Toyota",
      "model": "Corolla",
      "year": 2024,
      "vehicle_type": "petrol",
      "vehicle_mass_kg": 1350,
      "drag_coefficient": 0.29,
      "drivetrain_type": "fwd",
      "is_default": true,
      "created_at": "2026-04-09T10:00:00.000Z",
      "updated_at": "2026-04-09T10:00:00.000Z"
    }
  ]
}
```

**cURL Example:**

```bash
curl http://localhost:3000/api/vehicles \
  -H "Authorization: Bearer eyJhbGciOi..."
```

---

#### GET /api/vehicles/:id

**Description:** Get a single vehicle by ID. Must belong to the authenticated user.

**Auth required:** Yes

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | string (UUID) | Vehicle ID |

**Success Response:** `200 OK`

```json
{
  "success": true,
  "data": {
    "id": "b2c3d4e5-f6a7-8901-bcde-f12345678901",
    "make": "Toyota",
    "model": "Corolla",
    "year": 2024,
    "vehicle_type": "petrol",
    "vehicle_mass_kg": 1350,
    "drag_coefficient": 0.29,
    "drivetrain_type": "fwd",
    "is_default": true,
    "created_at": "2026-04-09T10:00:00.000Z",
    "updated_at": "2026-04-09T10:00:00.000Z"
  }
}
```

**Error Responses:**

| Status | Error | Description |
|--------|-------|-------------|
| 401 | `"Invalid or expired token"` | Authentication failed |
| 404 | `"Vehicle not found"` | Vehicle does not exist or does not belong to user |
| 422 | `[{ "msg": "Invalid vehicle ID", ... }]` | ID is not a valid UUID |

**cURL Example:**

```bash
curl http://localhost:3000/api/vehicles/b2c3d4e5-f6a7-8901-bcde-f12345678901 \
  -H "Authorization: Bearer eyJhbGciOi..."
```

---

#### PATCH /api/vehicles/:id

**Description:** Update a vehicle's details. Only provided fields are updated.

**Auth required:** Yes

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | string (UUID) | Vehicle ID |

**Request Body (all fields optional):**

| Field | Type | Validation | Description |
|-------|------|------------|-------------|
| `make` | string | Max 100 chars, non-empty | Manufacturer name |
| `model` | string | Max 100 chars, non-empty | Model name |
| `year` | number | Integer 1900-2100 | Model year |
| `vehicle_type` | string (enum) | `petrol` \| `diesel` \| `lpg` \| `ev` \| `hybrid` | Fuel/powertrain type |
| `vehicle_mass_kg` | number | Float 500-10000 | Kerb weight in kg |
| `drag_coefficient` | number | Float 0.1-1.0 | Drag coefficient |
| `drivetrain_type` | string (enum) | `fwd` \| `rwd` \| `awd` | Drivetrain layout |

**Example Request Body:**

```json
{
  "vehicle_mass_kg": 1400,
  "drag_coefficient": 0.31
}
```

**Success Response:** `200 OK`

```json
{
  "success": true,
  "data": {
    "id": "b2c3d4e5-f6a7-8901-bcde-f12345678901",
    "make": "Toyota",
    "model": "Corolla",
    "year": 2024,
    "vehicle_type": "petrol",
    "vehicle_mass_kg": 1400,
    "drag_coefficient": 0.31,
    "drivetrain_type": "fwd",
    "is_default": true,
    "created_at": "2026-04-09T10:00:00.000Z",
    "updated_at": "2026-04-09T10:05:00.000Z"
  }
}
```

**Error Responses:**

| Status | Error | Description |
|--------|-------|-------------|
| 401 | `"Invalid or expired token"` | Authentication failed |
| 404 | `"Vehicle not found or update failed"` | Vehicle does not exist or does not belong to user |
| 422 | `[{ "msg": "...", ... }]` | Validation failed |

**cURL Example:**

```bash
curl -X PATCH http://localhost:3000/api/vehicles/b2c3d4e5-f6a7-8901-bcde-f12345678901 \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer eyJhbGciOi..." \
  -d '{ "vehicle_mass_kg": 1400 }'
```

---

#### PATCH /api/vehicles/:id/default

**Description:** Set a vehicle as the user's default. Clears `is_default` on all other vehicles for that user.

**Auth required:** Yes

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | string (UUID) | Vehicle ID to set as default |

**Success Response:** `200 OK`

```json
{
  "success": true,
  "data": {
    "id": "b2c3d4e5-f6a7-8901-bcde-f12345678901",
    "make": "Toyota",
    "model": "Corolla",
    "year": 2024,
    "vehicle_type": "petrol",
    "vehicle_mass_kg": 1350,
    "drag_coefficient": 0.29,
    "drivetrain_type": "fwd",
    "is_default": true,
    "created_at": "2026-04-09T10:00:00.000Z",
    "updated_at": "2026-04-09T10:10:00.000Z"
  }
}
```

**Error Responses:**

| Status | Error | Description |
|--------|-------|-------------|
| 401 | `"Invalid or expired token"` | Authentication failed |
| 404 | `"Vehicle not found"` | Vehicle does not exist or does not belong to user |

**cURL Example:**

```bash
curl -X PATCH http://localhost:3000/api/vehicles/b2c3d4e5-f6a7-8901-bcde-f12345678901/default \
  -H "Authorization: Bearer eyJhbGciOi..."
```

---

#### DELETE /api/vehicles/:id

**Description:** Delete a vehicle. If the deleted vehicle was the default, the next remaining vehicle is promoted to default.

**Auth required:** Yes

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | string (UUID) | Vehicle ID to delete |

**Success Response:** `200 OK`

```json
{
  "success": true,
  "data": {
    "message": "Vehicle deleted"
  }
}
```

**Error Responses:**

| Status | Error | Description |
|--------|-------|-------------|
| 400 | `"..."` | Deletion failed (e.g. vehicle is referenced by active trips) |
| 401 | `"Invalid or expired token"` | Authentication failed |
| 404 | `"Vehicle not found"` | Vehicle does not exist or does not belong to user |

**cURL Example:**

```bash
curl -X DELETE http://localhost:3000/api/vehicles/b2c3d4e5-f6a7-8901-bcde-f12345678901 \
  -H "Authorization: Bearer eyJhbGciOi..."
```

---

### 4.3 Trips

---

#### POST /api/trips

**Description:** Start a new trip. The trip is created with status `active`. Telemetry can be streamed to it until it is ended.

**Auth required:** Yes

**Request Body:**

| Field | Type | Required | Validation | Description |
|-------|------|----------|------------|-------------|
| `vehicle_id` | string (UUID) | Yes | Valid UUID | Vehicle being driven |
| `started_at` | string (ISO 8601) | Yes | Valid ISO 8601 datetime | Trip start time |
| `origin_lat` | number | Yes | Float -90 to 90 | Origin latitude |
| `origin_lng` | number | Yes | Float -180 to 180 | Origin longitude |
| `dest_lat` | number | Yes | Float -90 to 90 | Destination latitude |
| `dest_lng` | number | Yes | Float -180 to 180 | Destination longitude |
| `fuel_type` | string (enum) | Yes | `petrol` \| `diesel` \| `lpg` \| `ev` \| `hybrid` | Fuel type for emission calculations |
| `origin_address` | string | No | - | Human-readable origin address |
| `dest_address` | string | No | - | Human-readable destination address |
| `route_polyline` | string | No | - | Encoded polyline of the planned route |

**Example Request Body:**

```json
{
  "vehicle_id": "b2c3d4e5-f6a7-8901-bcde-f12345678901",
  "started_at": "2026-04-09T08:30:00.000Z",
  "origin_lat": 3.1390,
  "origin_lng": 101.6869,
  "dest_lat": 3.1516,
  "dest_lng": 101.7033,
  "fuel_type": "petrol",
  "origin_address": "Kuala Lumpur Sentral",
  "dest_address": "KLCC"
}
```

**Success Response:** `201 Created`

```json
{
  "success": true,
  "data": {
    "id": "c3d4e5f6-a7b8-9012-cdef-123456789012",
    "user_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "vehicle_id": "b2c3d4e5-f6a7-8901-bcde-f12345678901",
    "status": "active",
    "started_at": "2026-04-09T08:30:00.000Z",
    "ended_at": null,
    "distance_km": null,
    "duration_sec": null,
    "route_polyline": null,
    "origin_lat": 3.139,
    "origin_lng": 101.6869,
    "origin_address": "Kuala Lumpur Sentral",
    "dest_lat": 3.1516,
    "dest_lng": 101.7033,
    "dest_address": "KLCC",
    "fuel_type": "petrol",
    "energy_kwh": null,
    "co2_kg": null,
    "excess_vs_optimal_pct": null,
    "driver_profile": null,
    "created_at": "2026-04-09T08:30:01.000Z"
  }
}
```

**Error Responses:**

| Status | Error | Description |
|--------|-------|-------------|
| 400 | `"..."` | Database insertion error |
| 401 | `"Invalid or expired token"` | Authentication failed |
| 422 | `[{ "msg": "...", ... }]` | Validation failed |

**cURL Example:**

```bash
curl -X POST http://localhost:3000/api/trips \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer eyJhbGciOi..." \
  -d '{
    "vehicle_id": "b2c3d4e5-f6a7-8901-bcde-f12345678901",
    "started_at": "2026-04-09T08:30:00.000Z",
    "origin_lat": 3.1390,
    "origin_lng": 101.6869,
    "dest_lat": 3.1516,
    "dest_lng": 101.7033,
    "fuel_type": "petrol"
  }'
```

---

#### GET /api/trips

**Description:** List trips for the authenticated user, ordered by `started_at` descending (most recent first). Supports **offset-based pagination**.

**Auth required:** Yes

**Query Parameters:**

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `page` | number | No | `1` | 1-indexed page number |
| `limit` | number | No | `20` | Items per page (max 100) |

**Success Response:** `200 OK`

```json
{
  "success": true,
  "data": {
    "data": [
      {
        "id": "c3d4e5f6-a7b8-9012-cdef-123456789012",
        "user_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
        "vehicle_id": "b2c3d4e5-f6a7-8901-bcde-f12345678901",
        "status": "ended",
        "started_at": "2026-04-09T08:30:00.000Z",
        "ended_at": "2026-04-09T09:00:00.000Z",
        "distance_km": 5.3,
        "duration_sec": 1800,
        "route_polyline": "encodedPolylineString...",
        "origin_lat": 3.139,
        "origin_lng": 101.6869,
        "origin_address": "Kuala Lumpur Sentral",
        "dest_lat": 3.1516,
        "dest_lng": 101.7033,
        "dest_address": "KLCC",
        "fuel_type": "petrol",
        "energy_kwh": 2.45,
        "co2_kg": 0.6115,
        "excess_vs_optimal_pct": 12.5,
        "driver_profile": "normal",
        "created_at": "2026-04-09T08:30:01.000Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 1,
      "total_pages": 1
    }
  }
}
```

**cURL Example:**

```bash
curl "http://localhost:3000/api/trips?page=1&limit=10" \
  -H "Authorization: Bearer eyJhbGciOi..."
```

---

#### GET /api/trips/:id

**Description:** Get a single trip by ID. Must belong to the authenticated user.

**Auth required:** Yes

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | string (UUID) | Trip ID |

**Success Response:** `200 OK` — same shape as a single item in the trip list above.

**Error Responses:**

| Status | Error | Description |
|--------|-------|-------------|
| 401 | `"Invalid or expired token"` | Authentication failed |
| 404 | `"Trip not found"` | Trip does not exist or does not belong to user |
| 422 | `[{ "msg": "Invalid trip ID", ... }]` | ID is not a valid UUID |

**cURL Example:**

```bash
curl http://localhost:3000/api/trips/c3d4e5f6-a7b8-9012-cdef-123456789012 \
  -H "Authorization: Bearer eyJhbGciOi..."
```

---

#### PATCH /api/trips/:id/end

**Description:** End an active trip. Sets status to `ended` and records final distance/duration. Triggers **async background processing**: aggregates segment energy into trip-level totals, derives driver profile, fetches route comparisons from RouteE Compass, and stores them. The response is returned immediately before background work completes.

**Auth required:** Yes

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | string (UUID) | Trip ID |

**Request Body:**

| Field | Type | Required | Validation | Description |
|-------|------|----------|------------|-------------|
| `ended_at` | string (ISO 8601) | Yes | Valid ISO 8601 datetime | Trip end time |
| `distance_km` | number | Yes | Float >= 0 | Total distance driven in km |
| `duration_sec` | number | Yes | Integer >= 0 | Total duration in seconds |

**Example Request Body:**

```json
{
  "ended_at": "2026-04-09T09:00:00.000Z",
  "distance_km": 5.3,
  "duration_sec": 1800
}
```

**Success Response:** `200 OK`

```json
{
  "success": true,
  "data": {
    "id": "c3d4e5f6-a7b8-9012-cdef-123456789012",
    "user_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "vehicle_id": "b2c3d4e5-f6a7-8901-bcde-f12345678901",
    "status": "ended",
    "started_at": "2026-04-09T08:30:00.000Z",
    "ended_at": "2026-04-09T09:00:00.000Z",
    "distance_km": 5.3,
    "duration_sec": 1800,
    "route_polyline": null,
    "origin_lat": 3.139,
    "origin_lng": 101.6869,
    "origin_address": "Kuala Lumpur Sentral",
    "dest_lat": 3.1516,
    "dest_lng": 101.7033,
    "dest_address": "KLCC",
    "fuel_type": "petrol",
    "energy_kwh": null,
    "co2_kg": null,
    "excess_vs_optimal_pct": null,
    "driver_profile": null,
    "created_at": "2026-04-09T08:30:01.000Z"
  }
}
```

> **Note:** `energy_kwh`, `co2_kg`, `driver_profile`, and `excess_vs_optimal_pct` will be `null` in the immediate response. They are populated asynchronously after background processing completes. Poll `GET /api/trips/:id` or use Supabase Realtime to detect when these fields are filled.

**Error Responses:**

| Status | Error | Description |
|--------|-------|-------------|
| 401 | `"Invalid or expired token"` | Authentication failed |
| 404 | `"Trip not found or already ended"` | Trip does not exist, does not belong to user, or status is not `active` |
| 422 | `[{ "msg": "...", ... }]` | Validation failed |

**cURL Example:**

```bash
curl -X PATCH http://localhost:3000/api/trips/c3d4e5f6-a7b8-9012-cdef-123456789012/end \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer eyJhbGciOi..." \
  -d '{
    "ended_at": "2026-04-09T09:00:00.000Z",
    "distance_km": 5.3,
    "duration_sec": 1800
  }'
```

---

#### PATCH /api/trips/:id/cancel

**Description:** Cancel an active trip. Only trips with status `active` can be cancelled. Sets the trip status to `cancelled`.

**Auth required:** Yes

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | string (UUID) | Trip ID |

**Success Response:** `200 OK`

```json
{
  "success": true,
  "data": {
    "id": "c3d4e5f6-a7b8-9012-cdef-123456789012",
    "user_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "vehicle_id": "b2c3d4e5-f6a7-8901-bcde-f12345678901",
    "status": "cancelled",
    "started_at": "2026-04-09T08:30:00.000Z",
    "ended_at": null,
    "distance_km": null,
    "duration_sec": null,
    "route_polyline": null,
    "origin_lat": 3.139,
    "origin_lng": 101.6869,
    "origin_address": "Kuala Lumpur Sentral",
    "dest_lat": 3.1516,
    "dest_lng": 101.7033,
    "dest_address": "KLCC",
    "fuel_type": "petrol",
    "energy_kwh": null,
    "co2_kg": null,
    "excess_vs_optimal_pct": null,
    "driver_profile": null,
    "created_at": "2026-04-09T08:30:01.000Z"
  }
}
```

**Error Responses:**

| Status | Error | Description |
|--------|-------|-------------|
| 401 | `"Invalid or expired token"` | Authentication failed |
| 404 | `"Trip not found or not active"` | Trip does not exist, does not belong to user, or is not `active` |
| 422 | `[{ "msg": "Invalid trip ID", ... }]` | ID is not a valid UUID |

**cURL Example:**

```bash
curl -X PATCH http://localhost:3000/api/trips/c3d4e5f6-a7b8-9012-cdef-123456789012/cancel \
  -H "Authorization: Bearer eyJhbGciOi..."
```

---

#### PATCH /api/trips/:id

**Description:** Update trip metadata. Only `route_polyline`, `origin_address`, and `dest_address` are editable.

**Auth required:** Yes

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | string (UUID) | Trip ID |

**Request Body (all fields optional):**

| Field | Type | Description |
|-------|------|-------------|
| `route_polyline` | string | Updated encoded polyline |
| `origin_address` | string | Updated origin address |
| `dest_address` | string | Updated destination address |

**Success Response:** `200 OK` — returns the full updated trip object.

**Error Responses:**

| Status | Error | Description |
|--------|-------|-------------|
| 401 | `"Invalid or expired token"` | Authentication failed |
| 404 | `"Trip not found"` | Trip does not exist or does not belong to user |

**cURL Example:**

```bash
curl -X PATCH http://localhost:3000/api/trips/c3d4e5f6-a7b8-9012-cdef-123456789012 \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer eyJhbGciOi..." \
  -d '{ "route_polyline": "updatedPolyline..." }'
```

---

### 4.4 Telemetry

---

#### POST /api/telemetry

**Description:** Bulk insert 1 Hz GPS + motion telemetry points for an active trip. The mobile app should batch points and send them periodically (e.g. every 30-60 seconds). Triggers **async ML segment analysis** in the background — segments and feedback events are created automatically when enough data has accumulated.

**Auth required:** Yes

**Request Body:**

| Field | Type | Required | Validation | Description |
|-------|------|----------|------------|-------------|
| `trip_id` | string (UUID) | Yes | Valid UUID | ID of the active trip |
| `points` | array | Yes | Non-empty array | Array of telemetry data points |

**Each point in the `points` array:**

| Field | Type | Required | Validation | Description |
|-------|------|----------|------------|-------------|
| `recorded_at` | string (ISO 8601) | Yes | Valid ISO 8601 datetime | Timestamp of the reading |
| `lat` | number | Yes | Float -90 to 90 | Latitude |
| `lng` | number | Yes | Float -180 to 180 | Longitude |
| `speed_ms` | number | No | Float >= 0 | Speed in m/s |
| `accel_ms2` | number | No | Float | Acceleration in m/s² |
| `altitude_m` | number | No | Float | Altitude in metres |
| `heading_deg` | number | No | Float 0-360 | Compass heading in degrees |

**Example Request Body:**

```json
{
  "trip_id": "c3d4e5f6-a7b8-9012-cdef-123456789012",
  "points": [
    {
      "recorded_at": "2026-04-09T08:30:01.000Z",
      "lat": 3.1391,
      "lng": 101.6870,
      "speed_ms": 8.5,
      "accel_ms2": 0.3,
      "altitude_m": 45.2,
      "heading_deg": 90
    },
    {
      "recorded_at": "2026-04-09T08:30:02.000Z",
      "lat": 3.1392,
      "lng": 101.6871,
      "speed_ms": 9.1,
      "accel_ms2": 0.6,
      "altitude_m": 45.3,
      "heading_deg": 91
    }
  ]
}
```

**Success Response:** `201 Created`

```json
{
  "success": true,
  "data": {
    "inserted": 2
  }
}
```

**Error Responses:**

| Status | Error | Description |
|--------|-------|-------------|
| 400 | `"..."` | Database insertion error |
| 401 | `"Invalid or expired token"` | Authentication failed |
| 404 | `"Trip not found"` | Trip does not exist or does not belong to user |
| 409 | `"Cannot insert telemetry for a trip that is not active"` | Trip has already ended or been cancelled |
| 422 | `[{ "msg": "...", ... }]` | Validation failed |

**cURL Example:**

```bash
curl -X POST http://localhost:3000/api/telemetry \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer eyJhbGciOi..." \
  -d '{
    "trip_id": "c3d4e5f6-a7b8-9012-cdef-123456789012",
    "points": [
      {
        "recorded_at": "2026-04-09T08:30:01.000Z",
        "lat": 3.1391,
        "lng": 101.6870,
        "speed_ms": 8.5,
        "accel_ms2": 0.3
      }
    ]
  }'
```

---

#### GET /api/telemetry/trip/:tripId

**Description:** Retrieve all raw telemetry points for a trip, ordered by `recorded_at` ascending.

**Auth required:** Yes

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `tripId` | string (UUID) | Trip ID |

**Success Response:** `200 OK`

```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "trip_id": "c3d4e5f6-a7b8-9012-cdef-123456789012",
      "recorded_at": "2026-04-09T08:30:01.000Z",
      "lat": 3.1391,
      "lng": 101.687,
      "speed_ms": 8.5,
      "accel_ms2": 0.3,
      "altitude_m": 45.2,
      "heading_deg": 90
    }
  ]
}
```

**Error Responses:**

| Status | Error | Description |
|--------|-------|-------------|
| 401 | `"Invalid or expired token"` | Authentication failed |
| 404 | `"Trip not found"` | Trip does not exist or does not belong to user |
| 422 | `[{ "msg": "Invalid trip ID", ... }]` | ID is not a valid UUID |

**cURL Example:**

```bash
curl http://localhost:3000/api/telemetry/trip/c3d4e5f6-a7b8-9012-cdef-123456789012 \
  -H "Authorization: Bearer eyJhbGciOi..."
```

---

### 4.5 Segments

---

#### GET /api/segments/trip/:tripId

**Description:** Retrieve all 60-second behavioural segments for a trip, ordered by `segment_index` ascending. Segments are created automatically by the ML pipeline when telemetry is ingested.

**Auth required:** Yes

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `tripId` | string (UUID) | Trip ID |

**Success Response:** `200 OK`

```json
{
  "success": true,
  "data": [
    {
      "id": "d4e5f6a7-b890-1234-defg-234567890123",
      "trip_id": "c3d4e5f6-a7b8-9012-cdef-123456789012",
      "segment_index": 0,
      "started_at": "2026-04-09T08:30:00.000Z",
      "ended_at": "2026-04-09T08:31:00.000Z",
      "avg_speed_kmh": 32.4,
      "speed_variance": 15.7,
      "accel_variance": 2.1,
      "braking_frequency": 0.8,
      "idle_time_pct": 5.2,
      "energy_kwh": 0.12,
      "behaviour_label": "moderate",
      "confidence": 0.87,
      "xgboost_efficiency_label": "suboptimal",
      "shap_top_feature": "accel_variance",
      "created_at": "2026-04-09T08:31:05.000Z"
    }
  ]
}
```

**Error Responses:**

| Status | Error | Description |
|--------|-------|-------------|
| 401 | `"Invalid or expired token"` | Authentication failed |
| 404 | `"Trip not found"` | Trip does not exist or does not belong to user |

**cURL Example:**

```bash
curl http://localhost:3000/api/segments/trip/c3d4e5f6-a7b8-9012-cdef-123456789012 \
  -H "Authorization: Bearer eyJhbGciOi..."
```

---

#### GET /api/segments/:id

**Description:** Get a single segment by ID. The segment's trip must belong to the authenticated user.

**Auth required:** Yes

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | string (UUID) | Segment ID |

**Success Response:** `200 OK` — same shape as a single item in the segment list above.

**Error Responses:**

| Status | Error | Description |
|--------|-------|-------------|
| 401 | `"Invalid or expired token"` | Authentication failed |
| 404 | `"Segment not found"` | Segment does not exist or its trip does not belong to user |

**cURL Example:**

```bash
curl http://localhost:3000/api/segments/d4e5f6a7-b890-1234-defg-234567890123 \
  -H "Authorization: Bearer eyJhbGciOi..."
```

---

### 4.6 Routes

---

#### POST /api/routes/autocomplete

**Description:** Search for places using Mapbox Search API. Used for the destination search bar in the mobile app.

**Auth required:** Yes

**Request Body:**

| Field | Type | Required | Validation | Description |
|-------|------|----------|------------|-------------|
| `query` | string | Yes | Non-empty | Search query text |
| `proximity_lat` | number | No | Float -90 to 90 | Bias results near this latitude |
| `proximity_lng` | number | No | Float -180 to 180 | Bias results near this longitude |

**Example Request Body:**

```json
{
  "query": "KLCC",
  "proximity_lat": 3.1390,
  "proximity_lng": 101.6869
}
```

**Success Response:** `200 OK`

```json
{
  "success": true,
  "data": [
    {
      "name": "KLCC - Kuala Lumpur City Centre",
      "full_address": "Kuala Lumpur City Centre, 50088 Kuala Lumpur",
      "lat": 3.1516,
      "lng": 101.7033
    }
  ]
}
```

**Error Responses:**

| Status | Error | Description |
|--------|-------|-------------|
| 401 | `"Invalid or expired token"` | Authentication failed |
| 422 | `[{ "msg": "query is required", ... }]` | Validation failed |
| 503 | `"Search service unavailable"` | Mapbox API is unreachable |

**cURL Example:**

```bash
curl -X POST http://localhost:3000/api/routes/autocomplete \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer eyJhbGciOi..." \
  -d '{ "query": "KLCC", "proximity_lat": 3.139, "proximity_lng": 101.687 }'
```

---

#### POST /api/routes/search

**Description:** Search for route alternatives between origin and destination using RouteE Compass. Returns up to 3 route options (eco, balanced, fastest) with energy estimates and polylines.

**Auth required:** Yes

**Request Body:**

| Field | Type | Required | Validation | Description |
|-------|------|----------|------------|-------------|
| `origin_lat` | number | Yes | Float -90 to 90 | Origin latitude |
| `origin_lng` | number | Yes | Float -180 to 180 | Origin longitude |
| `dest_lat` | number | Yes | Float -90 to 90 | Destination latitude |
| `dest_lng` | number | Yes | Float -180 to 180 | Destination longitude |
| `model_name` | string | No | Non-empty if provided | RouteE Compass vehicle model name |

**Example Request Body:**

```json
{
  "origin_lat": 3.1390,
  "origin_lng": 101.6869,
  "dest_lat": 3.1516,
  "dest_lng": 101.7033
}
```

**Success Response:** `200 OK`

```json
{
  "success": true,
  "data": [
    {
      "label": "eco",
      "distance_km": 5.1,
      "duration_sec": 1620,
      "energy_kwh": 1.95,
      "elevation_gain_km": 0.025,
      "polyline": "encodedPolylineString...",
      "warnings": []
    },
    {
      "label": "balanced",
      "distance_km": 4.8,
      "duration_sec": 1440,
      "energy_kwh": 2.15,
      "elevation_gain_km": 0.032,
      "polyline": "encodedPolylineString...",
      "warnings": []
    },
    {
      "label": "fastest",
      "distance_km": 4.5,
      "duration_sec": 1200,
      "energy_kwh": 2.45,
      "elevation_gain_km": 0.041,
      "polyline": "encodedPolylineString...",
      "warnings": []
    }
  ]
}
```

**Error Responses:**

| Status | Error | Description |
|--------|-------|-------------|
| 401 | `"Invalid or expired token"` | Authentication failed |
| 422 | `[{ "msg": "...", ... }]` | Validation failed |
| 503 | `"Routing service unavailable"` | RouteE Compass API is unreachable |

**cURL Example:**

```bash
curl -X POST http://localhost:3000/api/routes/search \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer eyJhbGciOi..." \
  -d '{
    "origin_lat": 3.1390,
    "origin_lng": 101.6869,
    "dest_lat": 3.1516,
    "dest_lng": 101.7033
  }'
```

---

#### GET /api/routes/trip/:tripId

**Description:** Retrieve post-trip route comparisons for a completed trip. These are generated asynchronously after a trip ends. Returns `eco`, `balanced`, and `fastest` alternatives with energy and CO2 estimates.

**Auth required:** Yes

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `tripId` | string (UUID) | Trip ID |

**Success Response:** `200 OK`

```json
{
  "success": true,
  "data": [
    {
      "id": "e5f6a7b8-9012-3456-efgh-345678901234",
      "trip_id": "c3d4e5f6-a7b8-9012-cdef-123456789012",
      "route_label": "balanced",
      "distance_km": 4.8,
      "estimated_energy_kwh": 2.15,
      "estimated_co2_kg": 0.5365,
      "elevation_gain_m": 32,
      "route_polyline": "encodedPolylineString...",
      "created_at": "2026-04-09T09:00:30.000Z"
    },
    {
      "id": "f6a7b890-1234-5678-fghi-456789012345",
      "trip_id": "c3d4e5f6-a7b8-9012-cdef-123456789012",
      "route_label": "eco",
      "distance_km": 5.1,
      "estimated_energy_kwh": 1.95,
      "estimated_co2_kg": 0.4867,
      "elevation_gain_m": 25,
      "route_polyline": "encodedPolylineString...",
      "created_at": "2026-04-09T09:00:30.000Z"
    },
    {
      "id": "a7b89012-3456-7890-ghij-567890123456",
      "trip_id": "c3d4e5f6-a7b8-9012-cdef-123456789012",
      "route_label": "fastest",
      "distance_km": 4.5,
      "estimated_energy_kwh": 2.45,
      "estimated_co2_kg": 0.6115,
      "elevation_gain_m": 41,
      "route_polyline": "encodedPolylineString...",
      "created_at": "2026-04-09T09:00:30.000Z"
    }
  ]
}
```

**Error Responses:**

| Status | Error | Description |
|--------|-------|-------------|
| 401 | `"Invalid or expired token"` | Authentication failed |
| 404 | `"Trip not found"` | Trip does not exist or does not belong to user |
| 422 | `[{ "msg": "Invalid trip ID", ... }]` | ID is not a valid UUID |

**cURL Example:**

```bash
curl http://localhost:3000/api/routes/trip/c3d4e5f6-a7b8-9012-cdef-123456789012 \
  -H "Authorization: Bearer eyJhbGciOi..."
```

---

### 4.7 Feedback Events

---

#### GET /api/feedback/trip/:tripId

**Description:** Retrieve all feedback events (behavioural nudges) for a trip, ordered by `triggered_at` ascending. Feedback events are auto-generated when the ML pipeline detects suboptimal driving segments.

**Auth required:** Yes

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `tripId` | string (UUID) | Trip ID |

**Success Response:** `200 OK`

```json
{
  "success": true,
  "data": [
    {
      "id": "g7h8i9j0-k1l2-m3n4-o5p6-q7r8s9t0u1v2",
      "trip_id": "c3d4e5f6-a7b8-9012-cdef-123456789012",
      "segment_id": "d4e5f6a7-b890-1234-defg-234567890123",
      "event_type": "harsh_accel",
      "message": "Rapid acceleration detected in segment 0. Smoother acceleration can reduce fuel consumption by up to 20%.",
      "triggered_at": "2026-04-09T08:31:05.000Z",
      "acknowledged": false
    },
    {
      "id": "h8i9j0k1-l2m3-n4o5-p6q7-r8s9t0u1v2w3",
      "trip_id": "c3d4e5f6-a7b8-9012-cdef-123456789012",
      "segment_id": "e5f6a7b8-c901-2345-efgh-345678901234",
      "event_type": "idling",
      "message": "Extended idling detected in segment 2. Consider turning off the engine during long stops.",
      "triggered_at": "2026-04-09T08:33:10.000Z",
      "acknowledged": false
    }
  ]
}
```

**Error Responses:**

| Status | Error | Description |
|--------|-------|-------------|
| 401 | `"Invalid or expired token"` | Authentication failed |
| 404 | `"Trip not found"` | Trip does not exist or does not belong to user |

**cURL Example:**

```bash
curl http://localhost:3000/api/feedback/trip/c3d4e5f6-a7b8-9012-cdef-123456789012 \
  -H "Authorization: Bearer eyJhbGciOi..."
```

---

#### PATCH /api/feedback/:id/acknowledge

**Description:** Mark a feedback event as acknowledged by the user.

**Auth required:** Yes

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | string (UUID) | Feedback event ID |

**Success Response:** `200 OK`

```json
{
  "success": true,
  "data": {
    "id": "g7h8i9j0-k1l2-m3n4-o5p6-q7r8s9t0u1v2",
    "trip_id": "c3d4e5f6-a7b8-9012-cdef-123456789012",
    "segment_id": "d4e5f6a7-b890-1234-defg-234567890123",
    "event_type": "harsh_accel",
    "message": "Rapid acceleration detected in segment 0. Smoother acceleration can reduce fuel consumption by up to 20%.",
    "triggered_at": "2026-04-09T08:31:05.000Z",
    "acknowledged": true
  }
}
```

**Error Responses:**

| Status | Error | Description |
|--------|-------|-------------|
| 400 | `"..."` | Update failed |
| 401 | `"Invalid or expired token"` | Authentication failed |
| 404 | `"Feedback event not found"` | Event does not exist or its trip does not belong to user |

**cURL Example:**

```bash
curl -X PATCH http://localhost:3000/api/feedback/g7h8i9j0-k1l2-m3n4-o5p6-q7r8s9t0u1v2/acknowledge \
  -H "Authorization: Bearer eyJhbGciOi..."
```

---

## 5. Data Models / Type Definitions

### 5.1 Entity Relationship Overview

```
User (1) ──── (*) Vehicle
User (1) ──── (*) Trip
Trip (1) ──── (*) RawTelemetry
Trip (1) ──── (*) TelemetrySegment
Trip (1) ──── (*) RouteComparison
Trip (1) ──── (*) FeedbackEvent
TelemetrySegment (1) ──── (0..1) FeedbackEvent
Trip (*) ──── (1) Vehicle
```

### 5.2 User

| Field | Type | Nullable | Required on Create | Description |
|-------|------|----------|--------------------|-------------|
| `id` | string (UUID) | No | Auto (from auth) | Primary key, matches `auth.users.id` |
| `email` | string | Yes | Auto | User's email address |
| `display_name` | string | Yes | No | Display name |
| `avatar_url` | string | Yes | No | Profile image URL |
| `role` | string (enum) | No | No (default: `user`) | `user` \| `admin` |
| `account_status` | string (enum) | No | No (default: `active`) | `active` \| `suspended` \| `deleted` |
| `auth_provider` | string (enum) | No | No (default: `email`) | `email` \| `google` \| `github` \| `apple` |
| `created_at` | string (ISO 8601) | No | Auto | Row creation timestamp |
| `updated_at` | string (ISO 8601) | No | Auto | Last update timestamp |

```typescript
interface User {
  id: string;           // UUID
  email: string | null;
  display_name: string | null;
  avatar_url: string | null;
  role: 'user' | 'admin';
  account_status: 'active' | 'suspended' | 'deleted';
  auth_provider: 'email' | 'google' | 'github' | 'apple';
  created_at: string;   // ISO 8601
  updated_at: string;   // ISO 8601
}
```

### 5.3 Vehicle

| Field | Type | Nullable | Required on Create | Description |
|-------|------|----------|--------------------|-------------|
| `id` | string (UUID) | No | Auto | Primary key |
| `user_id` | string (UUID) | No | Auto (from auth) | Owner's user ID |
| `make` | string | Yes | Yes | Manufacturer (e.g. "Toyota") |
| `model` | string | Yes | Yes | Model name (e.g. "Corolla") |
| `year` | number | Yes | No | Model year |
| `vehicle_type` | string (enum) | No | Yes | `petrol` \| `diesel` \| `lpg` \| `ev` \| `hybrid` |
| `vehicle_mass_kg` | number | Yes | No | Kerb weight in kg (500-10000) |
| `drag_coefficient` | number | Yes | No | Aerodynamic drag (0.1-1.0) |
| `drivetrain_type` | string (enum) | Yes | Yes | `fwd` \| `rwd` \| `awd` |
| `is_default` | boolean | No | No (auto) | Whether this is the user's default vehicle |
| `created_at` | string (ISO 8601) | No | Auto | Row creation timestamp |
| `updated_at` | string (ISO 8601) | No | Auto | Last update timestamp |

```typescript
interface Vehicle {
  id: string;                    // UUID
  user_id: string;               // UUID — FK → User.id
  make: string | null;
  model: string | null;
  year: number | null;
  vehicle_type: 'petrol' | 'diesel' | 'lpg' | 'ev' | 'hybrid';
  vehicle_mass_kg: number | null;
  drag_coefficient: number | null;
  drivetrain_type: 'fwd' | 'rwd' | 'awd' | null;
  is_default: boolean;
  created_at: string;            // ISO 8601
  updated_at: string;            // ISO 8601
}
```

### 5.4 Trip

| Field | Type | Nullable | Required on Create | Description |
|-------|------|----------|--------------------|-------------|
| `id` | string (UUID) | No | Auto | Primary key |
| `user_id` | string (UUID) | No | Auto (from auth) | Trip owner |
| `vehicle_id` | string (UUID) | Yes | Yes | Vehicle used for trip |
| `status` | string (enum) | No | No (default: `active`) | `active` \| `ended` \| `cancelled` |
| `started_at` | string (ISO 8601) | No | Yes | Trip start time |
| `ended_at` | string (ISO 8601) | Yes | No (set on end) | Trip end time |
| `distance_km` | number | Yes | No (set on end) | Total distance in km |
| `duration_sec` | number | Yes | No (set on end) | Total duration in seconds |
| `route_polyline` | string | Yes | No | Encoded polyline of route driven |
| `origin_lat` | number | No | Yes | Origin latitude |
| `origin_lng` | number | No | Yes | Origin longitude |
| `origin_address` | string | Yes | No | Human-readable origin |
| `dest_lat` | number | No | Yes | Destination latitude |
| `dest_lng` | number | No | Yes | Destination longitude |
| `dest_address` | string | Yes | No | Human-readable destination |
| `fuel_type` | string (enum) | Yes | Yes | `petrol` \| `diesel` \| `lpg` \| `ev` \| `hybrid` |
| `energy_kwh` | number | Yes | No (ML writeback) | Total energy consumed (kWh) |
| `co2_kg` | number | Yes | No (ML writeback) | Total CO2 emitted (kg) |
| `excess_vs_optimal_pct` | number | Yes | No (ML writeback) | % energy excess vs eco route |
| `driver_profile` | string (enum) | Yes | No (ML writeback) | `smooth` \| `normal` \| `aggressive` |
| `created_at` | string (ISO 8601) | No | Auto | Row creation timestamp |

```typescript
interface Trip {
  id: string;                         // UUID
  user_id: string;                    // UUID — FK → User.id
  vehicle_id: string | null;          // UUID — FK → Vehicle.id
  status: 'active' | 'ended' | 'cancelled';
  started_at: string;                 // ISO 8601
  ended_at: string | null;            // ISO 8601
  distance_km: number | null;
  duration_sec: number | null;
  route_polyline: string | null;
  origin_lat: number;
  origin_lng: number;
  origin_address: string | null;
  dest_lat: number;
  dest_lng: number;
  dest_address: string | null;
  fuel_type: string | null;           // 'petrol' | 'diesel' | 'lpg' | 'ev' | 'hybrid'
  energy_kwh: number | null;          // Populated async after trip ends
  co2_kg: number | null;              // Populated async after trip ends
  excess_vs_optimal_pct: number | null; // Populated async after trip ends
  driver_profile: 'smooth' | 'normal' | 'aggressive' | null;
  created_at: string;                 // ISO 8601
}
```

### 5.5 RawTelemetry

| Field | Type | Nullable | Required on Create | Description |
|-------|------|----------|--------------------|-------------|
| `id` | number (bigint) | No | Auto | Auto-incrementing primary key |
| `trip_id` | string (UUID) | No | Yes | Parent trip |
| `recorded_at` | string (ISO 8601) | No | Yes | Timestamp of reading |
| `lat` | number | No | Yes | Latitude |
| `lng` | number | No | Yes | Longitude |
| `speed_ms` | number | Yes | No | Speed in m/s |
| `accel_ms2` | number | Yes | No | Acceleration in m/s² |
| `altitude_m` | number | Yes | No | Altitude in metres |
| `heading_deg` | number | Yes | No | Compass heading (0-360) |

```typescript
interface RawTelemetry {
  id: number;                  // bigint
  trip_id: string;             // UUID — FK → Trip.id
  recorded_at: string;         // ISO 8601
  lat: number;
  lng: number;
  speed_ms: number | null;
  accel_ms2: number | null;
  altitude_m: number | null;
  heading_deg: number | null;
}
```

### 5.6 TelemetrySegment

| Field | Type | Nullable | Description |
|-------|------|----------|-------------|
| `id` | string (UUID) | No | Primary key |
| `trip_id` | string (UUID) | No | Parent trip |
| `segment_index` | number | No | 0-based segment number within trip |
| `started_at` | string (ISO 8601) | No | Segment start time |
| `ended_at` | string (ISO 8601) | No | Segment end time |
| `avg_speed_kmh` | number | Yes | Average speed in km/h |
| `speed_variance` | number | Yes | Speed variance |
| `accel_variance` | number | Yes | Acceleration variance (m/s²) — most predictive feature |
| `braking_frequency` | number | Yes | Braking events per km |
| `idle_time_pct` | number | Yes | % of segment time spent idle |
| `energy_kwh` | number | Yes | Energy consumed in this segment |
| `behaviour_label` | string (enum) | Yes | `smooth` \| `moderate` \| `aggressive` — XGBoost 3-way classification |
| `confidence` | number | Yes | Model confidence score (0-1) |
| `xgboost_efficiency_label` | string (enum) | Yes | `optimal` \| `suboptimal` — derived binary label |
| `shap_top_feature` | string | Yes | Most impactful SHAP feature for explainability |
| `created_at` | string (ISO 8601) | No | Row creation timestamp |

```typescript
interface TelemetrySegment {
  id: string;                           // UUID
  trip_id: string;                      // UUID — FK → Trip.id
  segment_index: number;
  started_at: string;                   // ISO 8601
  ended_at: string;                     // ISO 8601
  avg_speed_kmh: number | null;
  speed_variance: number | null;
  accel_variance: number | null;
  braking_frequency: number | null;
  idle_time_pct: number | null;
  energy_kwh: number | null;
  behaviour_label: 'smooth' | 'moderate' | 'aggressive' | null;
  confidence: number | null;
  xgboost_efficiency_label: 'optimal' | 'suboptimal' | null;
  shap_top_feature: string | null;
  created_at: string;                   // ISO 8601
}
```

### 5.7 RouteComparison

| Field | Type | Nullable | Description |
|-------|------|----------|-------------|
| `id` | string (UUID) | No | Primary key |
| `trip_id` | string (UUID) | No | Parent trip |
| `route_label` | string (enum) | No | `eco` \| `balanced` \| `fastest` |
| `distance_km` | number | Yes | Route distance in km |
| `estimated_energy_kwh` | number | Yes | FASTSim energy estimate |
| `estimated_co2_kg` | number | Yes | CO2 estimate based on IPCC factors |
| `elevation_gain_m` | number | Yes | Total elevation gain in metres |
| `route_polyline` | string | Yes | Encoded polyline |
| `created_at` | string (ISO 8601) | No | Row creation timestamp |

```typescript
interface RouteComparison {
  id: string;                          // UUID
  trip_id: string;                     // UUID — FK → Trip.id
  route_label: 'eco' | 'balanced' | 'fastest';
  distance_km: number | null;
  estimated_energy_kwh: number | null;
  estimated_co2_kg: number | null;
  elevation_gain_m: number | null;
  route_polyline: string | null;
  created_at: string;                  // ISO 8601
}
```

### 5.8 FeedbackEvent

| Field | Type | Nullable | Description |
|-------|------|----------|-------------|
| `id` | string (UUID) | No | Primary key |
| `trip_id` | string (UUID) | No | Parent trip |
| `segment_id` | string (UUID) | Yes | Associated segment (if applicable) |
| `event_type` | string (enum) | No | `harsh_accel` \| `harsh_brake` \| `idling` \| `speed_variance` |
| `message` | string | Yes | Human-readable feedback message from ML service |
| `triggered_at` | string (ISO 8601) | No | When the event was generated |
| `acknowledged` | boolean | No | Whether the user has seen/dismissed the feedback |

```typescript
interface FeedbackEvent {
  id: string;                    // UUID
  trip_id: string;               // UUID — FK → Trip.id
  segment_id: string | null;     // UUID — FK → TelemetrySegment.id
  event_type: 'harsh_accel' | 'harsh_brake' | 'idling' | 'speed_variance';
  message: string | null;
  triggered_at: string;          // ISO 8601
  acknowledged: boolean;
}
```

### 5.9 Session (Auth response only — not a DB table)

```typescript
interface Session {
  access_token: string;    // JWT — use in Authorization header
  expires_at: number;      // Unix epoch (seconds) when the token expires
}
```

### 5.10 RouteOption (Route search response only — not a DB table)

```typescript
interface RouteOption {
  label: 'eco' | 'balanced' | 'fastest';
  distance_km: number;
  duration_sec: number;
  energy_kwh: number | null;
  elevation_gain_km: number | null;
  polyline: string;
  warnings: string[];
}
```

---

## 6. Frontend Integration Flow (Step-by-Step)

### Step 1 — Auth Flow

Call `POST /api/auth/signup` or `POST /api/auth/signin`. Store the returned `access_token` in **secure storage** (e.g. `flutter_secure_storage` for Flutter, `expo-secure-store` for React Native). For a React web app, prefer **httpOnly cookies** set by a BFF proxy. If you must use `localStorage`, accept the XSS risk.

Attach the token to every subsequent request via an interceptor:

```typescript
import axios from 'axios';

const api = axios.create({
  baseURL: 'http://localhost:3000/api',
  headers: { 'Content-Type': 'application/json' },
});

// Attach auth token to every request
api.interceptors.request.use((config) => {
  const token = getAccessToken(); // Read from secure storage
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export default api;
```

### Step 2 — Token Refresh

Supabase JWTs expire after ~1 hour. If using the Supabase client SDK, token refresh is handled automatically. If using raw HTTP:

```typescript
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      // Use Supabase SDK to refresh
      const { data, error: refreshError } = await supabase.auth.refreshSession();
      if (refreshError) {
        // Redirect to login
        navigateToLogin();
        return Promise.reject(refreshError);
      }

      const newToken = data.session.access_token;
      storeAccessToken(newToken);
      originalRequest.headers.Authorization = `Bearer ${newToken}`;
      return api(originalRequest);
    }

    return Promise.reject(error);
  }
);
```

### Step 3 — Fetching Data

Use React Query (TanStack Query) for data fetching with caching and automatic refetching:

```typescript
import { useQuery } from '@tanstack/react-query';
import api from './api';

// Fetch user's trips
function useTrips() {
  return useQuery({
    queryKey: ['trips'],
    queryFn: async () => {
      const { data } = await api.get('/trips');
      return data.data; // Unwrap { success, data }
    },
  });
}

// Fetch a single trip with segments
function useTripDetail(tripId: string) {
  return useQuery({
    queryKey: ['trips', tripId],
    queryFn: async () => {
      const { data } = await api.get(`/trips/${tripId}`);
      return data.data;
    },
    enabled: !!tripId,
  });
}

// Usage in component
function TripList() {
  const { data: trips, isLoading, error } = useTrips();

  if (isLoading) return <LoadingSpinner />;
  if (error) return <ErrorMessage error={error} />;
  if (!trips?.length) return <EmptyState message="No trips yet" />;

  return trips.map(trip => <TripCard key={trip.id} trip={trip} />);
}
```

### Step 4 — Mutations

Use React Query mutations for POST/PATCH/DELETE with cache invalidation:

```typescript
import { useMutation, useQueryClient } from '@tanstack/react-query';

function useCreateTrip() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (tripData: CreateTripPayload) => {
      const { data } = await api.post('/trips', tripData);
      return data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trips'] });
    },
  });
}

function useEndTrip() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ tripId, ...body }: EndTripPayload) => {
      const { data } = await api.patch(`/trips/${tripId}/end`, body);
      return data.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['trips'] });
      queryClient.setQueryData(['trips', data.id], data);
    },
  });
}

function useAcknowledgeFeedback() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (feedbackId: string) => {
      const { data } = await api.patch(`/feedback/${feedbackId}/acknowledge`);
      return data.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['feedback', data.trip_id] });
    },
  });
}
```

### Step 5 — Pagination

Pagination is used on the vehicle catalog endpoints. Implement a paginated list:

```typescript
function useVehicleMakes(page: number = 1) {
  return useQuery({
    queryKey: ['vehicleMakes', page],
    queryFn: async () => {
      const { data } = await api.get(`/vehicles/makes?page=${page}&limit=20`);
      return data.data; // { data: string[], pagination: { page, limit, total, total_pages } }
    },
    placeholderData: keepPreviousData,
  });
}

// Usage
function MakeSelector() {
  const [page, setPage] = useState(1);
  const { data } = useVehicleMakes(page);

  return (
    <>
      {data?.data.map(make => <MakeItem key={make} name={make} />)}
      <Pagination
        page={data?.pagination.page}
        totalPages={data?.pagination.total_pages}
        onPageChange={setPage}
      />
    </>
  );
}
```

### Step 6 — Error Handling

Parse the universal error object to show user-facing messages:

```typescript
interface ApiError {
  success: false;
  error: string | ValidationError[];
}

interface ValidationError {
  type: string;
  value: unknown;
  msg: string;
  path: string;
  location: string;
}

function parseApiError(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data as ApiError | undefined;

    if (!data) return 'Network error. Please check your connection.';

    // Validation errors (422) — return first error message
    if (Array.isArray(data.error)) {
      return data.error.map(e => e.msg).join('. ');
    }

    // String error message
    if (typeof data.error === 'string') {
      return data.error;
    }
  }

  return 'An unexpected error occurred.';
}

// Map common errors to user-facing messages
const ERROR_MESSAGES: Record<number, string> = {
  401: 'Your session has expired. Please sign in again.',
  403: 'You do not have permission to perform this action.',
  404: 'The requested resource was not found.',
  409: 'This action conflicts with the current state.',
  500: 'Something went wrong on our end. Please try again.',
  503: 'Service temporarily unavailable. Please try again later.',
};
```

### Step 7 — Telemetry Streaming (Mobile-Specific)

The mobile app should batch telemetry points and send them periodically during an active trip. There are no file upload endpoints — all data is JSON.

```typescript
// Pseudocode for telemetry batching during a trip
class TelemetryBuffer {
  private points: TelemetryPoint[] = [];
  private tripId: string;
  private flushInterval: NodeJS.Timer;

  start(tripId: string) {
    this.tripId = tripId;
    this.flushInterval = setInterval(() => this.flush(), 30_000); // Every 30s
  }

  addPoint(point: TelemetryPoint) {
    this.points.push(point);
  }

  async flush() {
    if (this.points.length === 0) return;

    const batch = [...this.points];
    this.points = [];

    try {
      await api.post('/telemetry', {
        trip_id: this.tripId,
        points: batch,
      });
    } catch (error) {
      // Re-queue failed points for retry
      this.points = [...batch, ...this.points];
    }
  }

  async stop() {
    clearInterval(this.flushInterval);
    await this.flush(); // Final flush
  }
}
```

### Complete Axios Instance Setup

```typescript
import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';

const BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3000/api';

const api = axios.create({
  baseURL: BASE_URL,
  timeout: 30_000,
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  },
});

// Auth interceptor
api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = getAccessToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Error interceptor with 401 retry
api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

    // Auto-refresh on 401
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      const { data, error: refreshError } = await supabase.auth.refreshSession();
      if (refreshError) {
        clearAuth();
        window.location.href = '/login';
        return Promise.reject(refreshError);
      }

      storeAccessToken(data.session!.access_token);
      originalRequest.headers.Authorization = `Bearer ${data.session!.access_token}`;
      return api(originalRequest);
    }

    return Promise.reject(error);
  }
);

export default api;
```

---

## 7. Changelog / Versioning Notes

### Current Version

**v1.1.0** — 2026-04-15

### Changelog

| Date | Change | Breaking? |
|------|--------|-----------|
| 2026-04-15 | Add `PATCH /api/trips/:id/cancel` endpoint | No |
| 2026-04-15 | Add offset-based pagination to `GET /api/trips` — response shape changed from array to `{ data, pagination }` | Yes |
| 2026-04-15 | Add unit test suite (Jest) — 48 tests across controllers, middleware, and helpers | No |
| 2026-04-09 | Initial API documentation | - |
| 2026-04-08 | Enable Supabase Realtime on `feedback_events` table | No |
| 2026-04-07 | Fix `route_comparisons.route_label` constraint: now accepts `eco` \| `balanced` \| `fastest` instead of `taken` \| `alt_1` \| `alt_2` | Yes |
| 2026-04-06 | Add `behaviour_label` and `confidence` columns to `telemetry_segments` | No |
| 2026-04-05 | Add `status` column to `trips` table (`active` \| `ended` \| `cancelled`). `ended_at`, `distance_km`, `duration_sec` are now nullable | Yes |
| 2026-04-04 | Add `make`, `model`, `year` columns to `vehicles` table | No |
| 2026-04-03 | Remove `label` column from `vehicles` table | Yes |

### Upcoming Changes

- **API versioning** (`/v1/` prefix) will be introduced before the first public release.

### Realtime Integration (Preview)

The `feedback_events` table has Realtime enabled. Subscribe to new feedback during an active trip:

```typescript
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Subscribe to new feedback events for a specific trip
const channel = supabase
  .channel('feedback-events')
  .on(
    'postgres_changes',
    {
      event: 'INSERT',
      schema: 'public',
      table: 'feedback_events',
      filter: `trip_id=eq.${tripId}`,
    },
    (payload) => {
      const newFeedback = payload.new as FeedbackEvent;
      // Show real-time notification to the driver
      showFeedbackNotification(newFeedback);
    }
  )
  .subscribe();

// Cleanup when trip ends
channel.unsubscribe();
```
