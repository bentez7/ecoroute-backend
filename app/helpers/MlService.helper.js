'use strict';

const { ML_SERVICE_URL } = require('@config');
const Logger = require('@utils/Logger.util');

async function post(path, body) {
  const response = await fetch(`${ML_SERVICE_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`ML service ${path} returned ${response.status}: ${text}`);
  }

  return response.json();
}

// Called after each telemetry batch — ML service processes points and returns a
// segment if it has accumulated enough data (≥60s window). May return null if
// the window is not yet complete.
//
// ML service endpoint: POST /analyse/segment
// Body:   { trip_id, points: [{ recorded_at, lat, lng, speed_ms, accel_ms2, ... }] }
// Result: { segment: { segment_index, avg_speed_kmh, speed_variance, accel_variance,
//                      braking_frequency, idle_time_pct, energy_kwh,
//                      xgboost_efficiency_label, shap_top_feature,
//                      started_at, ended_at } | null }
async function analyseSegment(tripId, points) {
  try {
    return await post('/analyse/segment', { trip_id: tripId, points });
  } catch (err) {
    Logger.error(`[MlService] analyseSegment failed for trip ${tripId}: ${err.message}`);
    return null;
  }
}

// Called when a trip ends — ML service runs FASTSim + XGBoost over all segments
// to produce trip-level energy, CO2, and driver profile.
//
// ML service endpoint: POST /analyse/trip
// Body:   { trip_id, fuel_type, distance_km, duration_sec }
// Result: { energy_kwh, co2_kg, driver_profile, excess_vs_optimal_pct }
async function analyseTripSummary(tripId, { fuel_type, distance_km, duration_sec }) {
  try {
    return await post('/analyse/trip', { trip_id: tripId, fuel_type, distance_km, duration_sec });
  } catch (err) {
    Logger.error(`[MlService] analyseTripSummary failed for trip ${tripId}: ${err.message}`);
    return null;
  }
}

// Called when a trip ends — ML service runs FASTSim on alternative routes to
// estimate what energy/CO2 each alternative would have cost.
//
// ML service endpoint: POST /analyse/routes
// Body:   { trip_id, origin_lat, origin_lng, dest_lat, dest_lng, fuel_type,
//           routes: [{ route_label, route_polyline, distance_km, elevation_gain_m }] }
// Result: [{ route_label, estimated_energy_kwh, estimated_co2_kg,
//            distance_km, elevation_gain_m, route_polyline }]
async function analyseRouteComparisons(tripId, payload) {
  try {
    return await post('/analyse/routes', { trip_id: tripId, ...payload });
  } catch (err) {
    Logger.error(`[MlService] analyseRouteComparisons failed for trip ${tripId}: ${err.message}`);
    return null;
  }
}

module.exports = { analyseSegment, analyseTripSummary, analyseRouteComparisons };
