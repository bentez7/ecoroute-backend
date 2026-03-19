'use strict';

const { serviceClient, models } = require('@database');
const { TelemetrySegmentModel } = models;

const { TABLE, FIELDS } = TelemetrySegmentModel;

async function bulkInsert(tripId, segments) {
  const rows = segments.map(s => ({ ...s, [FIELDS.TRIP_ID]: tripId }));
  return serviceClient.from(TABLE).insert(rows).select();
}

async function getByTripId(tripId) {
  return serviceClient
    .from(TABLE)
    .select('*')
    .eq(FIELDS.TRIP_ID, tripId)
    .order(FIELDS.SEGMENT_INDEX, { ascending: true });
}

async function getById(segmentId) {
  return serviceClient
    .from(TABLE)
    .select('*')
    .eq(FIELDS.ID, segmentId)
    .single();
}

module.exports = { bulkInsert, getByTripId, getById };
