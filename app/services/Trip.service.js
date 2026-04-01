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

async function getByUserId(userId) {
  return serviceClient
    .from(TABLE)
    .select('*')
    .eq(FIELDS.USER_ID, userId)
    .order(FIELDS.STARTED_AT, { ascending: false });
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
    FIELDS.ROUTE_POLYLINE, FIELDS.ORIGIN_ADDRESS, FIELDS.DEST_ADDRESS,
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

module.exports = { create, getByUserId, getById, update, endTrip, writeMlResults };
