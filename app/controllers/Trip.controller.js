'use strict';

const Response = require('@helpers/Response.helper');

async function createTrip(req, res) {
  return Response.success(res, { message: 'not implemented' });
}

async function getTrips(req, res) {
  return Response.success(res, { message: 'not implemented' });
}

async function getTripById(req, res) {
  return Response.success(res, { message: 'not implemented' });
}

async function updateTrip(req, res) {
  return Response.success(res, { message: 'not implemented' });
}

module.exports = { createTrip, getTrips, getTripById, updateTrip };
