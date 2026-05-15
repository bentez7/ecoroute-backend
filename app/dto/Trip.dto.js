'use strict';

function tripDTO(trip) {
  return {
    id:                    trip.id,
    user_id:               trip.user_id,
    vehicle_id:            trip.vehicle_id,
    status:                trip.status,
    started_at:            trip.started_at,
    ended_at:              trip.ended_at,
    distance_km:           trip.distance_km,
    duration_sec:          trip.duration_sec,
    route_polyline:        trip.route_polyline,
    origin_lat:            trip.origin_lat,
    origin_lng:            trip.origin_lng,
    origin_address:        trip.origin_address,
    origin_name:           trip.origin_name,
    dest_lat:              trip.dest_lat,
    dest_lng:              trip.dest_lng,
    dest_address:          trip.dest_address,
    dest_name:             trip.dest_name,
    fuel_type:             trip.fuel_type,
    energy_kwh:            trip.energy_kwh,
    co2_kg:                trip.co2_kg,
    excess_vs_optimal_pct: trip.excess_vs_optimal_pct,
    driver_profile:        trip.driver_profile,
    created_at:            trip.created_at,
  };
}

function tripListDTO(trips) {
  return trips.map(tripDTO);
}

module.exports = { tripDTO, tripListDTO };
