'use strict';

const Response = require('@helpers/Response.helper');

async function getSegmentsByTrip(req, res) {
  return Response.success(res, { message: 'not implemented' });
}

async function getSegmentById(req, res) {
  return Response.success(res, { message: 'not implemented' });
}

module.exports = { getSegmentsByTrip, getSegmentById };
