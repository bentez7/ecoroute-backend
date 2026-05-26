'use strict';

const { serviceClient, models } = require('@database');
const { TripModel } = models;

const { TABLE, FIELDS, TRIP_STATUSES } = TripModel;

async function create(userId, tripData) {
  return serviceClient
    .from(TABLE)
    .insert({ ...tripData, [FIELDS.USER_ID]: userId, [FIELDS.STATUS]: TRIP_STATUSES.ACTIVE })
    .select()
    .single();
}

async function getByUserId(userId, { page = 1, limit = 20 } = {}) {
  const safeLimit = Math.min(100, Math.max(1, limit));
  const safePage  = Math.max(1, page);
  const offset    = (safePage - 1) * safeLimit;

  // Get total count
  const { count, error: countError } = await serviceClient
    .from(TABLE)
    .select('*', { count: 'exact', head: true })
    .eq(FIELDS.USER_ID, userId);

  if (countError) return { data: null, error: countError };

  // Get paginated data
  const { data, error } = await serviceClient
    .from(TABLE)
    .select('*')
    .eq(FIELDS.USER_ID, userId)
    .order(FIELDS.STARTED_AT, { ascending: false })
    .range(offset, offset + safeLimit - 1);

  if (error) return { data: null, error };

  return {
    data: {
      data,
      pagination: {
        page: safePage,
        limit: safeLimit,
        total: count,
        total_pages: Math.ceil(count / safeLimit),
      },
    },
    error: null,
  };
}

async function getById(tripId, userId) {
  return serviceClient
    .from(TABLE)
    .select('*')
    .eq(FIELDS.ID, tripId)
    .eq(FIELDS.USER_ID, userId)
    .single();
}

// Mobile app update (route polyline, addresses, etc.)
async function update(tripId, userId, updates) {
  const allowed = {};
  const editable = [
    FIELDS.ROUTE_POLYLINE,
    FIELDS.ORIGIN_ADDRESS, FIELDS.ORIGIN_NAME,
    FIELDS.DEST_ADDRESS,   FIELDS.DEST_NAME,
  ];
  for (const field of editable) {
    if (updates[field] !== undefined) allowed[field] = updates[field];
  }

  return serviceClient
    .from(TABLE)
    .update(allowed)
    .eq(FIELDS.ID, tripId)
    .eq(FIELDS.USER_ID, userId)
    .select()
    .single();
}

// End a trip — only succeeds if the trip is currently active (status guard at DB level)
async function endTrip(tripId, userId, { ended_at, distance_km, duration_sec }) {
  return serviceClient
    .from(TABLE)
    .update({
      [FIELDS.STATUS]:       TRIP_STATUSES.ENDED,
      [FIELDS.ENDED_AT]:     ended_at,
      [FIELDS.DISTANCE_KM]:  distance_km,
      [FIELDS.DURATION_SEC]: duration_sec,
    })
    .eq(FIELDS.ID, tripId)
    .eq(FIELDS.USER_ID, userId)
    .eq(FIELDS.STATUS, TRIP_STATUSES.ACTIVE)
    .select()
    .single();
}

// ML repo writeback — updates energy, CO2, driver profile, excess pct
async function writeMlResults(tripId, results) {
  const allowed = {};
  const mlFields = [
    FIELDS.ENERGY_KWH, FIELDS.CO2_KG,
    FIELDS.EXCESS_VS_OPTIMAL_PCT, FIELDS.DRIVER_PROFILE,
  ];
  for (const field of mlFields) {
    if (results[field] !== undefined) allowed[field] = results[field];
  }

  return serviceClient
    .from(TABLE)
    .update(allowed)
    .eq(FIELDS.ID, tripId)
    .select()
    .single();
}

// Cancel an active trip while preserving its data. Distance/duration come from
// the mobile (same fields it sends on /end) so the post-trip pipeline has the
// numbers it needs. The DB-level status guard ensures only active trips cancel.
async function cancelTrip(tripId, userId, { ended_at, distance_km, duration_sec }) {
  return serviceClient
    .from(TABLE)
    .update({
      [FIELDS.STATUS]:       TRIP_STATUSES.CANCELLED,
      [FIELDS.ENDED_AT]:     ended_at,
      [FIELDS.DISTANCE_KM]:  distance_km,
      [FIELDS.DURATION_SEC]: duration_sec,
    })
    .eq(FIELDS.ID, tripId)
    .eq(FIELDS.USER_ID, userId)
    .eq(FIELDS.STATUS, TRIP_STATUSES.ACTIVE)
    .select()
    .single();
}

// Hard-delete an active trip — used by cancelTrip when the user didn't drive
// far enough for the data to be worth keeping. FK ON DELETE CASCADE on the
// child tables (raw_telemetry, telemetry_segments, route_comparisons,
// feedback_events) clears everything in one transaction. Status guard prevents
// deleting trips that have already been ended or cancelled-with-data.
async function deleteTrip(tripId, userId) {
  const { error, count } = await serviceClient
    .from(TABLE)
    .delete({ count: 'exact' })
    .eq(FIELDS.ID, tripId)
    .eq(FIELDS.USER_ID, userId)
    .eq(FIELDS.STATUS, TRIP_STATUSES.ACTIVE);
  return { error, count };
}

// Aggregate stats for completed trips. Postgres does the SUMs and COUNT
// inside a SECURITY DEFINER RPC (see migration 013) so we ship four
// numbers over the wire instead of every row. PostgREST aggregate
// functions are disabled by default on hosted Supabase, hence the RPC.
async function getStatsByUserId(userId, { since = null } = {}) {
  const { data, error } = await serviceClient.rpc('get_user_trip_stats', {
    p_user_id: userId,
    p_since:   since,
  });

  if (error) return { data: null, error };

  // Postgres RETURNS TABLE always comes back as an array.
  const row = Array.isArray(data) ? data[0] : data;

  return {
    data: {
      total_trips:        Number(row?.total_trips        ?? 0),
      total_distance_km:  Number(row?.total_distance_km  ?? 0),
      total_duration_sec: Number(row?.total_duration_sec ?? 0),
      total_co2_kg:       Number(row?.total_co2_kg       ?? 0),
    },
    error: null,
  };
}

module.exports = {
  create, getByUserId, getById, update, endTrip, cancelTrip, deleteTrip,
  writeMlResults, getStatsByUserId,
};
