'use strict';

const { VehicleService }  = require('@services');
const { VehicleDTO }      = require('@dto');
const VehicleRegistry     = require('../integrations/VehicleRegistry.integration');
const Response            = require('@helpers/Response.helper');
const { VEHICLE_TYPES, DRIVETRAIN_TYPES } = require('@database').models.VehicleModel;

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

async function lookupVehicle(req, res) {
  const { registration_number } = req.body;

  try {
    const registryData = await VehicleRegistry.lookupByPlate(registration_number);
    return Response.success(res, VehicleDTO.vehicleLookupDTO(registryData));
  } catch (err) {
    return Response.error(res, err.message || 'Vehicle lookup failed', 404);
  }
}

function getOptions(req, res) {
  return Response.success(res, {
    vehicle_types:    Object.values(VEHICLE_TYPES),
    drivetrain_types: Object.values(DRIVETRAIN_TYPES),
  });
}

module.exports = { createVehicle, getVehicles, getVehicle, updateVehicle, setDefaultVehicle, deleteVehicle, lookupVehicle, getOptions };
