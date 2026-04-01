'use strict';

const swaggerJsdoc = require('swagger-jsdoc');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'EcoRoute Backend API',
      version: '1.0.0',
      description: 'Carbon-aware route planner — Supabase + Express backend',
    },
    servers: [
      { url: 'http://localhost:3000', description: 'Local development' },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'Supabase JWT from sign-in response',
        },
        serviceRoleKey: {
          type: 'http',
          scheme: 'bearer',
          description: 'Supabase service role key — ML repo only',
        },
      },
      schemas: {
        SuccessResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: true },
            data: { type: 'object' },
          },
        },
        ErrorResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: false },
            error: { type: 'string', example: 'Error message' },
          },
        },
        Pagination: {
          type: 'object',
          properties: {
            page:        { type: 'integer', example: 1 },
            limit:       { type: 'integer', example: 20 },
            total:       { type: 'integer', example: 22 },
            total_pages: { type: 'integer', example: 2 },
          },
        },
        User: {
          type: 'object',
          properties: {
            id:             { type: 'string', format: 'uuid' },
            email:          { type: 'string', format: 'email' },
            display_name:   { type: 'string' },
            avatar_url:     { type: 'string', nullable: true },
            role:           { type: 'string', enum: ['user', 'admin'], default: 'user' },
            account_status: { type: 'string', enum: ['active', 'suspended', 'deleted'] },
            created_at:     { type: 'string', format: 'date-time' },
            updated_at:     { type: 'string', format: 'date-time' },
          },
        },
        Vehicle: {
          type: 'object',
          properties: {
            id:               { type: 'string', format: 'uuid' },
            make:             { type: 'string', example: 'Perodua' },
            model:            { type: 'string', example: 'Myvi' },
            year:             { type: 'integer', example: 2022, nullable: true },
            vehicle_type:     { type: 'string', enum: ['petrol', 'diesel', 'lpg', 'ev', 'hybrid'] },
            vehicle_mass_kg:  { type: 'number', example: 1050 },
            drag_coefficient: { type: 'number', example: 0.32 },
            drivetrain_type:  { type: 'string', enum: ['fwd', 'rwd', 'awd'] },
            is_default:       { type: 'boolean', default: false },
            created_at:       { type: 'string', format: 'date-time' },
            updated_at:       { type: 'string', format: 'date-time' },
          },
        },
        VehicleVariant: {
          type: 'object',
          properties: {
            variant:          { type: 'string', example: '1.5 AV' },
            year:             { type: 'integer', example: 2022 },
            vehicle_type:     { type: 'string', enum: ['petrol', 'diesel', 'lpg', 'ev', 'hybrid'] },
            drivetrain_type:  { type: 'string', enum: ['fwd', 'rwd', 'awd'] },
            vehicle_mass_kg:  { type: 'number', example: 1050 },
          },
        },
        Trip: {
          type: 'object',
          properties: {
            id:                    { type: 'string', format: 'uuid' },
            user_id:               { type: 'string', format: 'uuid' },
            vehicle_id:            { type: 'string', format: 'uuid' },
            status:                { type: 'string', enum: ['active', 'ended', 'cancelled'], default: 'active' },
            started_at:            { type: 'string', format: 'date-time' },
            ended_at:              { type: 'string', format: 'date-time', nullable: true },
            distance_km:           { type: 'number', nullable: true },
            duration_sec:          { type: 'integer', nullable: true },
            origin_lat:            { type: 'number' },
            origin_lng:            { type: 'number' },
            origin_address:        { type: 'string', nullable: true },
            dest_lat:              { type: 'number' },
            dest_lng:              { type: 'number' },
            dest_address:          { type: 'string', nullable: true },
            route_polyline:        { type: 'string', nullable: true },
            fuel_type:             { type: 'string', enum: ['petrol', 'diesel', 'lpg', 'ev', 'hybrid'] },
            energy_kwh:            { type: 'number', nullable: true },
            co2_kg:                { type: 'number', nullable: true },
            excess_vs_optimal_pct: { type: 'number', nullable: true },
            driver_profile:        { type: 'string', enum: ['smooth', 'normal', 'aggressive'], nullable: true },
            created_at:            { type: 'string', format: 'date-time' },
          },
        },
        TelemetryPoint: {
          type: 'object',
          properties: {
            trip_id:     { type: 'string', format: 'uuid' },
            recorded_at: { type: 'string', format: 'date-time' },
            lat:         { type: 'number', example: 3.1390 },
            lng:         { type: 'number', example: 101.6869 },
            speed_ms:    { type: 'number', example: 13.9 },
            accel_ms2:   { type: 'number', example: 0.5 },
            altitude_m:  { type: 'number', example: 50.0 },
            heading_deg: { type: 'number', example: 180.0 },
          },
        },
        TelemetrySegment: {
          type: 'object',
          properties: {
            id:                       { type: 'string', format: 'uuid' },
            trip_id:                  { type: 'string', format: 'uuid' },
            segment_index:            { type: 'integer' },
            started_at:               { type: 'string', format: 'date-time' },
            ended_at:                 { type: 'string', format: 'date-time' },
            avg_speed_kmh:            { type: 'number' },
            speed_variance:           { type: 'number' },
            accel_variance:           { type: 'number' },
            braking_frequency:        { type: 'number' },
            idle_time_pct:            { type: 'number' },
            energy_kwh:               { type: 'number', nullable: true },
            xgboost_efficiency_label: { type: 'string', enum: ['optimal', 'suboptimal'], nullable: true },
            shap_top_feature:         { type: 'string', nullable: true },
          },
        },
        RouteComparison: {
          type: 'object',
          properties: {
            id:                    { type: 'string', format: 'uuid' },
            trip_id:               { type: 'string', format: 'uuid' },
            route_label:           { type: 'string', enum: ['taken', 'alt_1', 'alt_2'] },
            distance_km:           { type: 'number' },
            estimated_energy_kwh:  { type: 'number' },
            estimated_co2_kg:      { type: 'number' },
            elevation_gain_m:      { type: 'number', nullable: true },
            route_polyline:        { type: 'string', nullable: true },
          },
        },
        FeedbackEvent: {
          type: 'object',
          properties: {
            id:           { type: 'string', format: 'uuid' },
            trip_id:      { type: 'string', format: 'uuid' },
            segment_id:   { type: 'string', format: 'uuid', nullable: true },
            event_type:   { type: 'string', enum: ['harsh_accel', 'harsh_brake', 'idling', 'speed_variance'] },
            message:      { type: 'string' },
            triggered_at: { type: 'string', format: 'date-time' },
            acknowledged: { type: 'boolean', default: false },
          },
        },
      },
    },
    tags: [
      { name: 'Auth',     description: 'Authentication — sign up, sign in, sign out' },
      { name: 'Vehicles', description: 'User vehicle management. Use the cascading /makes, /models, /variants endpoints for dropdown selection.' },
      { name: 'Trips',    description: 'Trip CRUD' },
      { name: 'Telemetry', description: 'Raw GPS + motion data ingestion' },
      { name: 'Segments', description: 'Behavioural segments (written by ML repo)' },
      { name: 'Routes',   description: 'Route search (pre-trip, stateless proxy) and post-trip route comparisons (written by ML repo)' },
      { name: 'Feedback', description: 'In-app behavioural nudge events' },
      { name: 'ML',       description: 'ML repo writeback endpoints — service role key required' },
      { name: 'Health',   description: 'Server health check' },
    ],
    paths: {
      '/health': {
        get: {
          tags: ['Health'],
          summary: 'Health check',
          responses: {
            200: { description: 'Server is running' },
          },
        },
      },

      // ── Auth ────────────────────────────────────────────────────────────────
      '/api/auth/signup': {
        post: {
          tags: ['Auth'],
          summary: 'Create a new account',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['email', 'password'],
                  properties: {
                    email:        { type: 'string', format: 'email', example: 'user@example.com' },
                    password:     { type: 'string', minLength: 6, example: 'password123' },
                    display_name: { type: 'string', example: 'Jeremy Teng' },
                  },
                },
              },
            },
          },
          responses: {
            201: { description: 'Account created — returns user and session' },
            400: { description: 'Validation error or email already registered' },
          },
        },
      },
      '/api/auth/signin': {
        post: {
          tags: ['Auth'],
          summary: 'Sign in with email and password',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['email', 'password'],
                  properties: {
                    email:    { type: 'string', format: 'email' },
                    password: { type: 'string' },
                  },
                },
              },
            },
          },
          responses: {
            200: { description: 'Returns user and session with access_token' },
            401: { description: 'Invalid credentials' },
          },
        },
      },
      '/api/auth/signout': {
        post: {
          tags: ['Auth'],
          summary: 'Sign out and invalidate session',
          security: [{ bearerAuth: [] }],
          responses: {
            200: { description: 'Signed out successfully' },
            401: { description: 'Unauthorised' },
          },
        },
      },
      '/api/auth/me': {
        get: {
          tags: ['Auth'],
          summary: 'Get current user profile',
          security: [{ bearerAuth: [] }],
          responses: {
            200: { description: 'Returns the authenticated user profile', content: { 'application/json': { schema: { $ref: '#/components/schemas/User' } } } },
            401: { description: 'Unauthorised' },
          },
        },
      },

      // ── Vehicles ────────────────────────────────────────────────────────────
      '/api/vehicles/makes': {
        get: {
          tags: ['Vehicles'],
          summary: 'Get all available car makes',
          description: 'No auth required — returns a paginated list of car make names for the first dropdown.',
          parameters: [
            { name: 'page', in: 'query', schema: { type: 'integer', default: 1 }, description: 'Page number (default 1)' },
            { name: 'limit', in: 'query', schema: { type: 'integer', default: 20, maximum: 100 }, description: 'Items per page (default 20, max 100)' },
          ],
          responses: {
            200: {
              description: 'Paginated list of make names',
              content: { 'application/json': { schema: {
                type: 'object',
                properties: {
                  data:       { type: 'array', items: { type: 'string' }, example: ['Perodua', 'Proton', 'Toyota', 'Honda'] },
                  pagination: { $ref: '#/components/schemas/Pagination' },
                },
              } } },
            },
          },
        },
      },
      '/api/vehicles/makes/{make}/models': {
        get: {
          tags: ['Vehicles'],
          summary: 'Get all models for a given make',
          description: 'No auth required — returns paginated model names for the second dropdown.',
          parameters: [
            { name: 'make', in: 'path', required: true, schema: { type: 'string' }, example: 'Perodua' },
            { name: 'page', in: 'query', schema: { type: 'integer', default: 1 }, description: 'Page number (default 1)' },
            { name: 'limit', in: 'query', schema: { type: 'integer', default: 20, maximum: 100 }, description: 'Items per page (default 20, max 100)' },
          ],
          responses: {
            200: {
              description: 'Paginated list of model names',
              content: { 'application/json': { schema: {
                type: 'object',
                properties: {
                  data:       { type: 'array', items: { type: 'string' }, example: ['Myvi', 'Axia', 'Bezza'] },
                  pagination: { $ref: '#/components/schemas/Pagination' },
                },
              } } },
            },
            404: { description: 'Make not found' },
          },
        },
      },
      '/api/vehicles/makes/{make}/models/{model}/variants': {
        get: {
          tags: ['Vehicles'],
          summary: 'Get all variants for a given make and model',
          description: 'No auth required — returns paginated variant details to auto-fill the create form.',
          parameters: [
            { name: 'make', in: 'path', required: true, schema: { type: 'string' }, example: 'Perodua' },
            { name: 'model', in: 'path', required: true, schema: { type: 'string' }, example: 'Myvi' },
            { name: 'page', in: 'query', schema: { type: 'integer', default: 1 }, description: 'Page number (default 1)' },
            { name: 'limit', in: 'query', schema: { type: 'integer', default: 20, maximum: 100 }, description: 'Items per page (default 20, max 100)' },
          ],
          responses: {
            200: {
              description: 'Paginated list of variant objects with pre-filled vehicle details',
              content: { 'application/json': { schema: {
                type: 'object',
                properties: {
                  data:       { type: 'array', items: { $ref: '#/components/schemas/VehicleVariant' } },
                  pagination: { $ref: '#/components/schemas/Pagination' },
                },
              } } },
            },
            404: { description: 'Make or model not found' },
          },
        },
      },
      '/api/vehicles': {
        post: {
          tags: ['Vehicles'],
          summary: 'Add a new vehicle',
          description: 'First vehicle is automatically set as default.',
          security: [{ bearerAuth: [] }],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['make', 'model', 'vehicle_type', 'drivetrain_type'],
                  properties: {
                    make:             { type: 'string', example: 'Perodua' },
                    model:            { type: 'string', example: 'Myvi' },
                    year:             { type: 'integer', example: 2022 },
                    vehicle_type:     { type: 'string', enum: ['petrol', 'diesel', 'lpg', 'ev', 'hybrid'] },
                    vehicle_mass_kg:  { type: 'number', example: 1050, minimum: 500, maximum: 10000 },
                    drag_coefficient: { type: 'number', example: 0.32, minimum: 0.1, maximum: 1.0 },
                    drivetrain_type:  { type: 'string', enum: ['fwd', 'rwd', 'awd'] },
                  },
                },
              },
            },
          },
          responses: {
            201: { description: 'Vehicle created', content: { 'application/json': { schema: { $ref: '#/components/schemas/Vehicle' } } } },
            401: { description: 'Unauthorised' },
            422: { description: 'Validation error' },
          },
        },
        get: {
          tags: ['Vehicles'],
          summary: 'List all vehicles for the current user',
          security: [{ bearerAuth: [] }],
          responses: {
            200: { description: 'Array of vehicles', content: { 'application/json': { schema: { type: 'array', items: { $ref: '#/components/schemas/Vehicle' } } } } },
            401: { description: 'Unauthorised' },
          },
        },
      },
      '/api/vehicles/{id}': {
        get: {
          tags: ['Vehicles'],
          summary: 'Get a single vehicle by ID',
          security: [{ bearerAuth: [] }],
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
          responses: {
            200: { description: 'Vehicle object', content: { 'application/json': { schema: { $ref: '#/components/schemas/Vehicle' } } } },
            401: { description: 'Unauthorised' },
            404: { description: 'Vehicle not found' },
          },
        },
        patch: {
          tags: ['Vehicles'],
          summary: 'Update a vehicle',
          security: [{ bearerAuth: [] }],
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
          requestBody: {
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    make:             { type: 'string' },
                    model:            { type: 'string' },
                    year:             { type: 'integer' },
                    vehicle_type:     { type: 'string', enum: ['petrol', 'diesel', 'lpg', 'ev', 'hybrid'] },
                    vehicle_mass_kg:  { type: 'number', minimum: 500, maximum: 10000 },
                    drag_coefficient: { type: 'number', minimum: 0.1, maximum: 1.0 },
                    drivetrain_type:  { type: 'string', enum: ['fwd', 'rwd', 'awd'] },
                  },
                },
              },
            },
          },
          responses: {
            200: { description: 'Vehicle updated', content: { 'application/json': { schema: { $ref: '#/components/schemas/Vehicle' } } } },
            401: { description: 'Unauthorised' },
            404: { description: 'Vehicle not found' },
            422: { description: 'Validation error' },
          },
        },
        delete: {
          tags: ['Vehicles'],
          summary: 'Delete a vehicle',
          description: 'If the deleted vehicle was the default, the most recently created remaining vehicle is promoted.',
          security: [{ bearerAuth: [] }],
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
          responses: {
            200: { description: 'Vehicle deleted' },
            401: { description: 'Unauthorised' },
            404: { description: 'Vehicle not found' },
          },
        },
      },
      '/api/vehicles/{id}/default': {
        patch: {
          tags: ['Vehicles'],
          summary: 'Set a vehicle as default',
          description: 'Clears is_default on all other vehicles for this user.',
          security: [{ bearerAuth: [] }],
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
          responses: {
            200: { description: 'Vehicle set as default', content: { 'application/json': { schema: { $ref: '#/components/schemas/Vehicle' } } } },
            401: { description: 'Unauthorised' },
            404: { description: 'Vehicle not found' },
          },
        },
      },

      // ── Trips ────────────────────────────────────────────────────────────────
      '/api/trips': {
        post: {
          tags: ['Trips'],
          summary: 'Start a new trip',
          description: 'Called when the user begins a trip. Trip is created with status "active". Call PATCH /:id/end when the trip finishes.',
          security: [{ bearerAuth: [] }],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['vehicle_id', 'started_at', 'origin_lat', 'origin_lng', 'dest_lat', 'dest_lng', 'fuel_type'],
                  properties: {
                    vehicle_id:     { type: 'string', format: 'uuid' },
                    started_at:     { type: 'string', format: 'date-time' },
                    origin_lat:     { type: 'number', example: 3.1390 },
                    origin_lng:     { type: 'number', example: 101.6869 },
                    origin_address: { type: 'string', nullable: true },
                    dest_lat:       { type: 'number', example: 3.2000 },
                    dest_lng:       { type: 'number', example: 101.7000 },
                    dest_address:   { type: 'string', nullable: true },
                    route_polyline: { type: 'string', nullable: true },
                    fuel_type:      { type: 'string', enum: ['petrol', 'diesel', 'lpg', 'ev', 'hybrid'] },
                  },
                },
              },
            },
          },
          responses: {
            201: { description: 'Trip created with status "active"' },
            401: { description: 'Unauthorised' },
            422: { description: 'Validation error' },
          },
        },
        get: {
          tags: ['Trips'],
          summary: 'List all trips for the current user',
          security: [{ bearerAuth: [] }],
          responses: {
            200: { description: 'Array of trips ordered by started_at desc' },
            401: { description: 'Unauthorised' },
          },
        },
      },
      '/api/trips/{id}': {
        get: {
          tags: ['Trips'],
          summary: 'Get a single trip by ID',
          security: [{ bearerAuth: [] }],
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
          responses: {
            200: { description: 'Trip object' },
            401: { description: 'Unauthorised' },
            404: { description: 'Trip not found' },
          },
        },
        patch: {
          tags: ['Trips'],
          summary: 'Update a trip (polyline / addresses)',
          security: [{ bearerAuth: [] }],
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
          requestBody: {
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    route_polyline: { type: 'string' },
                    origin_address: { type: 'string' },
                    dest_address:   { type: 'string' },
                  },
                },
              },
            },
          },
          responses: {
            200: { description: 'Trip updated' },
            401: { description: 'Unauthorised' },
            404: { description: 'Trip not found' },
          },
        },
      },
      '/api/trips/{id}/end': {
        patch: {
          tags: ['Trips'],
          summary: 'End an active trip',
          description: 'Sets status to "ended" and records final distance, duration, and end time. Only succeeds if the trip is currently active.',
          security: [{ bearerAuth: [] }],
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['ended_at', 'distance_km', 'duration_sec'],
                  properties: {
                    ended_at:     { type: 'string', format: 'date-time' },
                    distance_km:  { type: 'number', minimum: 0 },
                    duration_sec: { type: 'integer', minimum: 0 },
                  },
                },
              },
            },
          },
          responses: {
            200: { description: 'Trip ended — returns updated trip with status "ended"' },
            401: { description: 'Unauthorised' },
            404: { description: 'Trip not found or already ended' },
            422: { description: 'Validation error' },
          },
        },
      },

      // ── Telemetry ────────────────────────────────────────────────────────────
      '/api/telemetry': {
        post: {
          tags: ['Telemetry'],
          summary: 'Bulk insert raw telemetry points (batch from mobile app)',
          description: 'Accepts an array of GPS+motion points for an active trip. Returns 409 if the trip has already ended.',
          security: [{ bearerAuth: [] }],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['trip_id', 'points'],
                  properties: {
                    trip_id: { type: 'string', format: 'uuid' },
                    points: {
                      type: 'array',
                      items: { $ref: '#/components/schemas/TelemetryPoint' },
                    },
                  },
                },
              },
            },
          },
          responses: {
            201: { description: 'Points inserted' },
            401: { description: 'Unauthorised' },
          },
        },
      },
      '/api/telemetry/trip/{tripId}': {
        get: {
          tags: ['Telemetry'],
          summary: 'Get all raw telemetry points for a trip',
          security: [{ bearerAuth: [] }],
          parameters: [{ name: 'tripId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
          responses: {
            200: { description: 'Array of telemetry points' },
            401: { description: 'Unauthorised' },
          },
        },
      },

      // ── Segments ─────────────────────────────────────────────────────────────
      '/api/segments/trip/{tripId}': {
        get: {
          tags: ['Segments'],
          summary: 'Get all behavioural segments for a trip',
          security: [{ bearerAuth: [] }],
          parameters: [{ name: 'tripId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
          responses: {
            200: { description: 'Array of segments ordered by segment_index' },
            401: { description: 'Unauthorised' },
          },
        },
      },
      '/api/segments/{id}': {
        get: {
          tags: ['Segments'],
          summary: 'Get a single segment by ID',
          security: [{ bearerAuth: [] }],
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
          responses: {
            200: { description: 'Segment object' },
            401: { description: 'Unauthorised' },
            404: { description: 'Segment not found' },
          },
        },
      },

      // ── Routes ───────────────────────────────────────────────────────────────
      '/api/routes/search': {
        post: {
          tags: ['Routes'],
          summary: 'Search for route options between two points',
          description: 'Stateless proxy to the external routing service. Nothing is stored — the frontend passes the chosen polyline when calling POST /api/trips.',
          security: [{ bearerAuth: [] }],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['origin_lat', 'origin_lng', 'dest_lat', 'dest_lng'],
                  properties: {
                    origin_lat: { type: 'number', example: 3.1390 },
                    origin_lng: { type: 'number', example: 101.6869 },
                    dest_lat:   { type: 'number', example: 3.2000 },
                    dest_lng:   { type: 'number', example: 101.7000 },
                  },
                },
              },
            },
          },
          responses: {
            200: { description: 'Array of route options with polyline, distance_km, duration_sec, elevation_gain_m' },
            401: { description: 'Unauthorised' },
            422: { description: 'Validation error' },
            503: { description: 'Routing service unavailable' },
          },
        },
      },
      '/api/routes/trip/{tripId}': {
        get: {
          tags: ['Routes'],
          summary: 'Get route comparisons for a trip',
          security: [{ bearerAuth: [] }],
          parameters: [{ name: 'tripId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
          responses: {
            200: { description: 'Array of route comparison objects (taken + alternatives)' },
            401: { description: 'Unauthorised' },
          },
        },
      },

      // ── Feedback ─────────────────────────────────────────────────────────────
      '/api/feedback/trip/{tripId}': {
        get: {
          tags: ['Feedback'],
          summary: 'Get all feedback events for a trip',
          security: [{ bearerAuth: [] }],
          parameters: [{ name: 'tripId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
          responses: {
            200: { description: 'Array of feedback events' },
            401: { description: 'Unauthorised' },
          },
        },
      },
      '/api/feedback/{id}/acknowledge': {
        patch: {
          tags: ['Feedback'],
          summary: 'Mark a feedback event as acknowledged',
          security: [{ bearerAuth: [] }],
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
          responses: {
            200: { description: 'Feedback event acknowledged' },
            401: { description: 'Unauthorised' },
            404: { description: 'Feedback event not found' },
          },
        },
      },

      // ── ML Writeback ─────────────────────────────────────────────────────────
      '/api/ml/trips/{tripId}/results': {
        patch: {
          tags: ['ML'],
          summary: 'Write back computed trip energy, CO2, and driver profile',
          security: [{ serviceRoleKey: [] }],
          parameters: [{ name: 'tripId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    energy_kwh:            { type: 'number' },
                    co2_kg:                { type: 'number' },
                    excess_vs_optimal_pct: { type: 'number' },
                    driver_profile:        { type: 'string', enum: ['smooth', 'normal', 'aggressive'] },
                  },
                },
              },
            },
          },
          responses: {
            200: { description: 'Trip updated with ML results' },
            403: { description: 'Invalid or missing service role key' },
          },
        },
      },
      '/api/ml/trips/{tripId}/segments': {
        post: {
          tags: ['ML'],
          summary: 'Write back computed behavioural segments for a trip',
          security: [{ serviceRoleKey: [] }],
          parameters: [{ name: 'tripId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['segments'],
                  properties: {
                    segments: {
                      type: 'array',
                      items: { $ref: '#/components/schemas/TelemetrySegment' },
                    },
                  },
                },
              },
            },
          },
          responses: {
            201: { description: 'Segments written and feedback events auto-generated' },
            403: { description: 'Invalid or missing service role key' },
          },
        },
      },
      '/api/ml/trips/{tripId}/routes': {
        post: {
          tags: ['ML'],
          summary: 'Write back route comparison data for a trip',
          security: [{ serviceRoleKey: [] }],
          parameters: [{ name: 'tripId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['routes'],
                  properties: {
                    routes: {
                      type: 'array',
                      items: { $ref: '#/components/schemas/RouteComparison' },
                    },
                  },
                },
              },
            },
          },
          responses: {
            201: { description: 'Route comparisons written' },
            403: { description: 'Invalid or missing service role key' },
          },
        },
      },
    },
  },
  apis: [],
};

module.exports = swaggerJsdoc(options);
