'use strict';

const { serviceClient, models } = require('@database');
const { RouteComparisonModel } = models;

const { TABLE, FIELDS } = RouteComparisonModel;

async function bulkInsert(tripId, routes) {
  const rows = routes.map(r => ({ ...r, [FIELDS.TRIP_ID]: tripId }));
  return serviceClient.from(TABLE).insert(rows).select();
}

async function getByTripId(tripId) {
  return serviceClient
    .from(TABLE)
    .select('*')
    .eq(FIELDS.TRIP_ID, tripId)
    .order(FIELDS.ROUTE_LABEL, { ascending: true });
}

module.exports = { bulkInsert, getByTripId };
