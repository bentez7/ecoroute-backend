'use strict';

const { TripService } = require('@services');
const { TripDTO }     = require('@dto');
const Response        = require('@helpers/Response.helper');

async function createTrip(req, res) {
  const userId = req.user.id;
  const {
    vehicle_id, started_at,
    origin_lat, origin_lng, origin_address,
    dest_lat, dest_lng, dest_address,
    route_polyline, fuel_type,
  } = req.body;

  const { data, error } = await TripService.create(userId, {
    vehicle_id, started_at,
    origin_lat, origin_lng, origin_address,
    dest_lat, dest_lng, dest_address,
    route_polyline, fuel_type,
  });
  if (error) return Response.error(res, error.message, 400);

  return Response.success(res, TripDTO.tripDTO(data), 201);
}

async function getTrips(req, res) {
  const { data, error } = await TripService.getByUserId(req.user.id);
  if (error) return Response.error(res, error.message, 400);

  return Response.success(res, TripDTO.tripListDTO(data));
}

async function getTripById(req, res) {
  const { data, error } = await TripService.getById(req.params.id, req.user.id);
  if (error || !data) return Response.error(res, 'Trip not found', 404);

  return Response.success(res, TripDTO.tripDTO(data));
}

async function endTrip(req, res) {
  const { ended_at, distance_km, duration_sec } = req.body;

  const { data, error } = await TripService.endTrip(
    req.params.id, req.user.id,
    { ended_at, distance_km, duration_sec },
  );

  // endTrip guards status = 'active'; no match means not found or already ended
  if (error || !data) return Response.error(res, 'Trip not found or already ended', 404);

  return Response.success(res, TripDTO.tripDTO(data));
}

async function updateTrip(req, res) {
  const { data, error } = await TripService.update(req.params.id, req.user.id, req.body);
  if (error || !data) return Response.error(res, 'Trip not found', 404);

  return Response.success(res, TripDTO.tripDTO(data));
}

module.exports = { createTrip, getTrips, getTripById, endTrip, updateTrip };
