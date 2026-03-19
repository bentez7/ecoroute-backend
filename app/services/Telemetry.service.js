'use strict';

const { serviceClient, models } = require('@database');
const { RawTelemetryModel } = models;

const { TABLE, FIELDS } = RawTelemetryModel;

async function bulkInsert(tripId, points) {
  const rows = points.map(p => ({ ...p, [FIELDS.TRIP_ID]: tripId }));
  return serviceClient.from(TABLE).insert(rows).select();
}

async function getByTripId(tripId) {
  return serviceClient
    .from(TABLE)
    .select('*')
    .eq(FIELDS.TRIP_ID, tripId)
    .order(FIELDS.RECORDED_AT, { ascending: true });
}

module.exports = { bulkInsert, getByTripId };
