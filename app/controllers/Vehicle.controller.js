'use strict';

const Response = require('@helpers/Response.helper');

async function createVehicle(req, res) {
  return Response.success(res, { message: 'not implemented' });
}

async function getVehicles(req, res) {
  return Response.success(res, { message: 'not implemented' });
}

async function updateVehicle(req, res) {
  return Response.success(res, { message: 'not implemented' });
}

async function deleteVehicle(req, res) {
  return Response.success(res, { message: 'not implemented' });
}

module.exports = { createVehicle, getVehicles, updateVehicle, deleteVehicle };
