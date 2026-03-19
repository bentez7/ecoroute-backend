'use strict';

const Response = require('@helpers/Response.helper');

async function bulkInsertTelemetry(req, res) {
  return Response.success(res, { message: 'not implemented' });
}

async function getTelemetryByTrip(req, res) {
  return Response.success(res, { message: 'not implemented' });
}

module.exports = { bulkInsertTelemetry, getTelemetryByTrip };
