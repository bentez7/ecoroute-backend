'use strict';

const { VehicleService }  = require('@services');
const { VehicleDTO }      = require('@dto');
const Response            = require('@helpers/Response.helper');
const { paginate }        = require('@helpers/Pagination.helper');
const vehicleMakes        = require('../data/vehicle-makes.json');

async function createVehicle(req, res) {
  const { make, model, year, vehicle_type, vehicle_mass_kg, drag_coefficient, drivetrain_type } = req.body;
  const userId = req.user.id;

  // Auto-set first vehicle as default
  const { data: existing } = await VehicleService.getByUserId(userId);
  const isDefault = !existing || existing.length === 0;

  const { data, error } = await VehicleService.create(userId, {
    make, model, year, vehicle_type, vehicle_mass_kg, drag_coefficient, drivetrain_type,
    is_default: isDefault,
  });
  if (error) return Response.error(res, error.message, 400);

  return Response.success(res, VehicleDTO.vehicleDTO(data), 201);
}

async function getVehicles(req, res) {
  const { data, error } = await VehicleService.getByUserId(req.user.id);
  if (error) return Response.error(res, error.message, 400);

  return Response.success(res, VehicleDTO.vehicleListDTO(data));
}

async function getVehicle(req, res) {
  const { data, error } = await VehicleService.getById(req.params.id, req.user.id);
  if (error) return Response.error(res, 'Vehicle not found', 404);

  return Response.success(res, VehicleDTO.vehicleDTO(data));
}

async function updateVehicle(req, res) {
  const { data, error } = await VehicleService.update(req.params.id, req.user.id, req.body);
  if (error) return Response.error(res, 'Vehicle not found or update failed', 404);

  return Response.success(res, VehicleDTO.vehicleDTO(data));
}

async function setDefaultVehicle(req, res) {
  const { data, error } = await VehicleService.setDefault(req.params.id, req.user.id);
  if (error) return Response.error(res, 'Vehicle not found', 404);

  return Response.success(res, VehicleDTO.vehicleDTO(data));
}

async function deleteVehicle(req, res) {
  const userId = req.user.id;

  // Check if vehicle exists and whether it's the default
  const { data: vehicle, error: fetchError } = await VehicleService.getById(req.params.id, userId);
  if (fetchError) return Response.error(res, 'Vehicle not found', 404);

  const wasDefault = vehicle.is_default;

  const { error } = await VehicleService.remove(req.params.id, userId);
  if (error) return Response.error(res, error.message, 400);

  // Promote next vehicle if we just deleted the default
  if (wasDefault) {
    const { data: remaining } = await VehicleService.getByUserId(userId);
    if (remaining && remaining.length > 0) {
      await VehicleService.setDefault(remaining[0].id, userId);
    }
  }

  return Response.success(res, { message: 'Vehicle deleted' });
}

function getMakes(req, res) {
  const makes = vehicleMakes.map(entry => entry.make);
  return Response.success(res, paginate(makes, req.query));
}

function getModels(req, res) {
  const { make } = req.params;
  const entry = vehicleMakes.find(e => e.make.toLowerCase() === make.toLowerCase());
  if (!entry) return Response.error(res, 'Make not found', 404);

  const models = entry.models.map(m => m.model);
  return Response.success(res, paginate(models, req.query));
}

function getVariants(req, res) {
  const { make, model } = req.params;
  const makeEntry = vehicleMakes.find(e => e.make.toLowerCase() === make.toLowerCase());
  if (!makeEntry) return Response.error(res, 'Make not found', 404);

  const modelEntry = makeEntry.models.find(m => m.model.toLowerCase() === model.toLowerCase());
  if (!modelEntry) return Response.error(res, 'Model not found', 404);

  return Response.success(res, paginate(modelEntry.variants, req.query));
}

module.exports = {
  createVehicle, getVehicles, getVehicle, updateVehicle, setDefaultVehicle, deleteVehicle,
  getMakes, getModels, getVariants,
};
