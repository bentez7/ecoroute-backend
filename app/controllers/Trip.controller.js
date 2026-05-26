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

// Cancellation threshold — below this distance we discard the trip entirely
// (cascade-deletes telemetry, segments, feedback, comparisons).
const CANCEL_KEEP_THRESHOLD_KM = 0.5;

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

  setImmediate(() => runPostTripAnalysis(data));
}

// Cancellation has two modes depending on how far the user actually drove:
//  - distance < CANCEL_KEEP_THRESHOLD_KM → hard-delete the trip (cascade clears
//    all telemetry / segments / feedback / comparisons via FK ON DELETE CASCADE)
//  - distance >= threshold → mark cancelled, persist distance/duration, and run
//    the same post-trip pipeline as endTrip so energy & CO2 reflect what was
//    actually driven up to the cancel point
async function cancelTrip(req, res) {
  const { ended_at, distance_km, duration_sec } = req.body;
  const tripId = req.params.id;
  const userId = req.user.id;

  if (distance_km < CANCEL_KEEP_THRESHOLD_KM) {
    const { error, count } = await TripService.deleteTrip(tripId, userId);
    if (error)   return Response.error(res, error.message, 400);
    if (!count)  return Response.error(res, 'Trip not found or not active', 404);
    return Response.success(res, { deleted: true });
  }

  const { data, error } = await TripService.cancelTrip(tripId, userId, {
    ended_at, distance_km, duration_sec,
  });
  if (error || !data) return Response.error(res, 'Trip not found or not active', 404);

  res.status(200).json({ success: true, data: TripDTO.tripDTO(data) });

  setImmediate(() => runPostTripAnalysis(data));
}

// Shared post-trip pipeline. Computes energy/CO2 from telemetry, derives the
// driver profile, fetches route comparisons against the originally planned
// destination, and persists everything. Runs the same way for endTrip and
// for kept cancellations.
async function runPostTripAnalysis(trip) {
  const tripId    = trip.id;
  const fuel_type = trip.fuel_type;

  try {
    const [segmentsRes, telemetryRes] = await Promise.all([
      SegmentService.getByTripId(tripId),
      TelemetryService.getByTripId(tripId),
    ]);
    const segments = segmentsRes.data ?? [];
    const points   = telemetryRes.data ?? [];

    const driver_profile = deriveDriverProfile(segments);

    const { energy_kwh, co2_kg, error: simError } = await RoutingService.simulateTripEnergy({
      points,
      model_name: DEFAULT_FASTSIM_MODEL,
      fuel_type,
    });
    if (simError) {
      Logger.warn(`[Trip] simulate failed for trip ${tripId}: ${simError.message}`);
    }

    const { comparisons } = await RoutingService.computeRouteComparisons({
      origin_lat: trip.origin_lat,
      origin_lng: trip.origin_lng,
      dest_lat:   trip.dest_lat,
      dest_lng:   trip.dest_lng,
      fuel_type,
    });

    const eco = comparisons?.find(r => r.route_label === 'eco');
    const excess_vs_optimal_pct =
      energy_kwh != null && eco?.estimated_energy_kwh
        ? ((energy_kwh - eco.estimated_energy_kwh) / eco.estimated_energy_kwh) * 100
        : null;

    await TripService.writeMlResults(tripId, {
      energy_kwh, co2_kg, driver_profile, excess_vs_optimal_pct,
    });

    if (co2_kg != null) {
      await UserService.incrementCO2(trip.user_id, co2_kg);
    }

    if (comparisons?.length) {
      await RouteComparisonService.bulkInsert(tripId, comparisons);
    }
  } catch (err) {
    Logger.error(`[Trip] post-trip analysis failed for trip ${tripId}: ${err.message}`);
  }
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
