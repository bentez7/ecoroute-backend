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

// Called after each telemetry batch during an active trip.
// The ML service accumulates points per trip_id and returns completed 10-second
// windows. Returns { segments: [] } while the buffer is still filling.
//
// ML service endpoint: POST /analyse/segment
// Body:   { trip_id, points: [{ recorded_at, lat, lng, speed_ms, altitude_m }] }
// Result: { segments: [{ segment_index, started_at, ended_at, behaviour_label,
//                        confidence, alert, avg_speed_kmh, accel_variance,
//                        braking_frequency, idle_time_pct, shap_top_feature }] }
async function analyseSegment(tripId, points) {
  try {
    return await post('/analyse/segment', { trip_id: tripId, points });
  } catch (err) {
    Logger.error(`[MlService] analyseSegment failed for trip ${tripId}: ${err.message}`);
    return null;
  }
}

module.exports = { analyseSegment };
