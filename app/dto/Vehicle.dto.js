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

module.exports = { vehicleDTO, vehicleListDTO };
