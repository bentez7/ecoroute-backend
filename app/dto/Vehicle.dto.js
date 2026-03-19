'use strict';

function vehicleDTO(vehicle) {
  return {
    id:               vehicle.id,
    make:             vehicle.make,
    model:            vehicle.model,
    year:             vehicle.year,
    vehicle_type:     vehicle.vehicle_type,
    vehicle_mass_kg:  vehicle.vehicle_mass_kg,
    drag_coefficient: vehicle.drag_coefficient,
    drivetrain_type:  vehicle.drivetrain_type,
    is_default:       vehicle.is_default,
    created_at:       vehicle.created_at,
    updated_at:       vehicle.updated_at,
  };
}

function vehicleListDTO(vehicles) {
  return vehicles.map(vehicleDTO);
}

function vehicleLookupDTO(registryData) {
  return {
    make:         registryData.make,
    model:        registryData.model,
    year:         registryData.year,
    fuel_type:    registryData.fuel_type,
    engine_size:  registryData.engine_size,
    transmission: registryData.transmission,
    body_style:   registryData.body_style,
  };
}

module.exports = { vehicleDTO, vehicleListDTO, vehicleLookupDTO };
