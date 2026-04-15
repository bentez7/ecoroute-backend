'use strict';

const { TripService, RouteComparisonService, SegmentService } = require('@services');
const { TripDTO }       = require('@dto');
const RoutingService    = require('@helpers/RoutingService.helper');
const { calcCO2 }       = require('@helpers/Emission.helper');
const Response          = require('@helpers/Response.helper');
const Logger            = require('@utils/Logger.util');

async function createTrip(req, res) {
  const userId = req.user.id;
  const {
    vehicle_id, started_at,
    origin_lat, origin_lng, origin_address,
    dest_lat, dest_lng, dest_address,
    route_polyline, fuel_type,
  } = req.body;

  const { data, error } = await TripService.create(userId, {
    vehicle_id, started_at,
    origin_lat, origin_lng, origin_address,
    dest_lat, dest_lng, dest_address,
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
  // All inputs are already in the DB — no ML service calls needed here.
  setImmediate(async () => {
    const tripId    = data.id;
    const fuel_type = data.fuel_type;

    try {
      // 1. Fetch segments written during the trip by the real-time ML pipeline
      const { data: segments } = await SegmentService.getByTripId(tripId);

      // 2. Derive driver profile from per-segment behaviour labels (escalation rule)
      const driver_profile = deriveDriverProfile(segments ?? []);

      // 3. Sum segment energy for trip-level total (null if no segment has energy data)
      const energy_kwh = sumSegmentEnergy(segments ?? []);
      const co2_kg     = energy_kwh != null ? calcCO2(energy_kwh, fuel_type) : null;

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

      // 7. Persist route comparisons
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

// Sum energy_kwh across all segments. Returns null if none of the segments
// carry energy data (ML service currently does not compute per-segment energy).
function sumSegmentEnergy(segments) {
  const values = segments.map(s => s.energy_kwh).filter(v => v != null);
  return values.length ? values.reduce((acc, v) => acc + v, 0) : null;
}

module.exports = { createTrip, getTrips, getTripById, endTrip, cancelTrip, updateTrip };
