'use strict';

const {
  TripService, RouteComparisonService, SegmentService, TelemetryService, UserService,
} = require('@services');
const { TripDTO }       = require('@dto');
const RoutingService    = require('@helpers/RoutingService.helper');
const Response          = require('@helpers/Response.helper');
const Logger            = require('@utils/Logger.util');

// FASTSim catalog only ships these 6 models. We default every trip to a
// petrol sedan; per-vehicle mapping can be wired in later if needed.
const DEFAULT_FASTSIM_MODEL = '2012_Ford_Fusion';

async function createTrip(req, res) {
  const userId = req.user.id;
  const {
    vehicle_id, started_at,
    origin_lat, origin_lng, origin_address, origin_name,
    dest_lat, dest_lng, dest_address, dest_name,
    route_polyline, fuel_type,
  } = req.body;

  const { data, error } = await TripService.create(userId, {
    vehicle_id, started_at,
    origin_lat, origin_lng, origin_address, origin_name,
    dest_lat, dest_lng, dest_address, dest_name,
    route_polyline, fuel_type,
  });
  if (error) return Response.error(res, error.message, 400);

  return Response.success(res, TripDTO.tripDTO(data), 201);
}

async function getTrips(req, res) {
  const page  = parseInt(req.query.page, 10) || 1;
  const limit = parseInt(req.query.limit, 10) || 20;

  const { data, error } = await TripService.getByUserId(req.user.id, { page, limit });
  if (error) return Response.error(res, error.message, 400);

  return Response.success(res, {
    data: TripDTO.tripListDTO(data.data),
    pagination: data.pagination,
  });
}

async function getTripStats(req, res) {
  // Optional ?since=<iso>; ignored if not a valid ISO datetime.
  const rawSince = typeof req.query.since === 'string' ? req.query.since : null;
  const sinceDate = rawSince ? new Date(rawSince) : null;
  const since = sinceDate && !Number.isNaN(sinceDate.getTime())
    ? sinceDate.toISOString()
    : null;

  const { data, error } = await TripService.getStatsByUserId(req.user.id, { since });
  if (error) return Response.error(res, error.message, 400);
  return Response.success(res, data);
}

async function getTripById(req, res) {
  const { data, error } = await TripService.getById(req.params.id, req.user.id);
  if (error || !data) return Response.error(res, 'Trip not found', 404);

  return Response.success(res, TripDTO.tripDTO(data));
}

async function endTrip(req, res) {
  const { ended_at, distance_km, duration_sec } = req.body;

  const { data, error } = await TripService.endTrip(
    req.params.id, req.user.id,
    { ended_at, distance_km, duration_sec },
  );

  // endTrip guards status = 'active'; no match means not found or already ended
  if (error || !data) return Response.error(res, 'Trip not found or already ended', 404);

  // Respond immediately — post-trip analysis runs async
  res.status(200).json({ success: true, data: TripDTO.tripDTO(data) });

  // Derive trip-level summary + route comparisons in the background.
  setImmediate(async () => {
    const tripId    = data.id;
    const fuel_type = data.fuel_type;

    try {
      // 1. Fetch segments + raw telemetry in parallel
      const [segmentsRes, telemetryRes] = await Promise.all([
        SegmentService.getByTripId(tripId),
        TelemetryService.getByTripId(tripId),
      ]);
      const segments = segmentsRes.data ?? [];
      const points   = telemetryRes.data ?? [];

      // 2. Derive driver profile from per-segment behaviour labels (escalation rule)
      const driver_profile = deriveDriverProfile(segments);

      // 3. Actual trip energy & CO2 from FASTSim over the recorded telemetry
      const { energy_kwh, co2_kg, error: simError } = await RoutingService.simulateTripEnergy({
        points,
        model_name: DEFAULT_FASTSIM_MODEL,
        fuel_type,
      });
      if (simError) {
        Logger.warn(`[Trip] simulate failed for trip ${tripId}: ${simError.message}`);
      }

      // 4. Fetch alternative routes from RouteE Compass and store comparisons
      const { comparisons } = await RoutingService.computeRouteComparisons({
        origin_lat: data.origin_lat,
        origin_lng: data.origin_lng,
        dest_lat:   data.dest_lat,
        dest_lng:   data.dest_lng,
        fuel_type,
      });

      // 5. excess_vs_optimal_pct: how much more energy than the eco route was used
      const eco = comparisons?.find(r => r.route_label === 'eco');
      const excess_vs_optimal_pct =
        energy_kwh != null && eco?.estimated_energy_kwh
          ? ((energy_kwh - eco.estimated_energy_kwh) / eco.estimated_energy_kwh) * 100
          : null;

      // 6. Persist trip-level results
      await TripService.writeMlResults(tripId, {
        energy_kwh, co2_kg, driver_profile, excess_vs_optimal_pct,
      });

      // 7. Increment user's cumulative carbon footprint
      if (co2_kg != null) {
        await UserService.incrementCO2(data.user_id, co2_kg);
      }

      // 8. Persist route comparisons
      if (comparisons?.length) {
        await RouteComparisonService.bulkInsert(tripId, comparisons);
      }
    } catch (err) {
      Logger.error(`[Trip] post-trip analysis failed for trip ${tripId}: ${err.message}`);
    }
  });
}

async function cancelTrip(req, res) {
  const { data, error } = await TripService.cancelTrip(req.params.id, req.user.id);
  if (error || !data) return Response.error(res, 'Trip not found or not active', 404);

  return Response.success(res, TripDTO.tripDTO(data));
}

async function updateTrip(req, res) {
  const { data, error } = await TripService.update(req.params.id, req.user.id, req.body);
  if (error || !data) return Response.error(res, 'Trip not found', 404);

  return Response.success(res, TripDTO.tripDTO(data));
}

// ---------------------------------------------------------------------------
// Pure helpers — no DB access
// ---------------------------------------------------------------------------

// Escalation rule: any aggressive segment → 'aggressive';
// any moderate (without aggressive) → 'normal'; otherwise → 'smooth'.
function deriveDriverProfile(segments) {
  if (!segments.length) return 'smooth';
  const labels = segments.map(s => s.behaviour_label).filter(Boolean);
  if (labels.includes('aggressive')) return 'aggressive';
  if (labels.includes('moderate'))  return 'normal';
  return 'smooth';
}

module.exports = {
  createTrip, getTrips, getTripStats, getTripById, endTrip, cancelTrip, updateTrip,
};
