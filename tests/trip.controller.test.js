'use strict';

const { mockReq, mockRes } = require('./helpers');

jest.mock('@database', () => ({
  anonClient:    {},
  serviceClient: {},
  models:        {},
}));
jest.mock('@services', () => ({
  TripService:           { create: jest.fn(), getByUserId: jest.fn(), getById: jest.fn(), endTrip: jest.fn(), cancelTrip: jest.fn(), deleteTrip: jest.fn(), update: jest.fn(), writeMlResults: jest.fn() },
  SegmentService:        { getByTripId: jest.fn() },
  RouteComparisonService: { bulkInsert: jest.fn() },
  UserService:           { incrementCO2: jest.fn() },
}));
jest.mock('@helpers/RoutingService.helper', () => ({
  computeRouteComparisons: jest.fn(),
}));
jest.mock('@helpers/Emission.helper', () => ({
  calcCO2: jest.fn(() => 0.5),
}));
jest.mock('@utils/Logger.util', () => ({
  info: jest.fn(), warn: jest.fn(), error: jest.fn(),
}));

const { TripService } = require('@services');
const TripController = require('@controllers/Trip.controller');

const FAKE_TRIP = {
  id: 'trip-1', user_id: 'user-uuid-1', vehicle_id: 'v1', status: 'active',
  started_at: '2026-04-09T08:00:00Z', ended_at: null,
  distance_km: null, duration_sec: null, route_polyline: null,
  origin_lat: 3.13, origin_lng: 101.68, origin_address: null,
  dest_lat: 3.15, dest_lng: 101.70, dest_address: null,
  fuel_type: 'petrol', energy_kwh: null, co2_kg: null,
  excess_vs_optimal_pct: null, driver_profile: null,
  created_at: '2026-04-09T08:00:01Z',
};

describe('Trip Controller', () => {
  afterEach(() => jest.clearAllMocks());

  // --- createTrip ---
  describe('createTrip', () => {
    it('returns 201 on success', async () => {
      TripService.create.mockResolvedValue({ data: FAKE_TRIP, error: null });

      const req = mockReq({ body: {
        vehicle_id: 'v1', started_at: '2026-04-09T08:00:00Z',
        origin_lat: 3.13, origin_lng: 101.68, dest_lat: 3.15, dest_lng: 101.70,
        fuel_type: 'petrol',
      }});
      const res = mockRes();

      await TripController.createTrip(req, res);

      expect(res._status).toBe(201);
      expect(res._json.success).toBe(true);
      expect(res._json.data.id).toBe('trip-1');
    });

    it('returns 400 on service error', async () => {
      TripService.create.mockResolvedValue({ data: null, error: { message: 'DB error' } });

      const req = mockReq({ body: {} });
      const res = mockRes();

      await TripController.createTrip(req, res);

      expect(res._status).toBe(400);
      expect(res._json.success).toBe(false);
    });
  });

  // --- getTrips (paginated) ---
  describe('getTrips', () => {
    it('returns paginated trips', async () => {
      TripService.getByUserId.mockResolvedValue({
        data: {
          data: [FAKE_TRIP],
          pagination: { page: 1, limit: 20, total: 1, total_pages: 1 },
        },
        error: null,
      });

      const req = mockReq({ query: { page: '1', limit: '20' } });
      const res = mockRes();

      await TripController.getTrips(req, res);

      expect(res._status).toBe(200);
      expect(res._json.data.pagination.total).toBe(1);
      expect(res._json.data.data).toHaveLength(1);
    });

    it('passes page and limit to service', async () => {
      TripService.getByUserId.mockResolvedValue({
        data: { data: [], pagination: { page: 2, limit: 5, total: 10, total_pages: 2 } },
        error: null,
      });

      const req = mockReq({ query: { page: '2', limit: '5' } });
      const res = mockRes();

      await TripController.getTrips(req, res);

      expect(TripService.getByUserId).toHaveBeenCalledWith('user-uuid-1', { page: 2, limit: 5 });
    });
  });

  // --- getTripById ---
  describe('getTripById', () => {
    it('returns 200 with trip data', async () => {
      TripService.getById.mockResolvedValue({ data: FAKE_TRIP, error: null });

      const req = mockReq({ params: { id: 'trip-1' } });
      const res = mockRes();

      await TripController.getTripById(req, res);

      expect(res._status).toBe(200);
      expect(res._json.data.id).toBe('trip-1');
    });

    it('returns 404 when trip not found', async () => {
      TripService.getById.mockResolvedValue({ data: null, error: null });

      const req = mockReq({ params: { id: 'nope' } });
      const res = mockRes();

      await TripController.getTripById(req, res);

      expect(res._status).toBe(404);
      expect(res._json.error).toBe('Trip not found');
    });
  });

  // --- cancelTrip ---
  describe('cancelTrip', () => {
    const CANCEL_BODY_ABOVE = { ended_at: '2026-04-09T08:35:00Z', distance_km: 3.2, duration_sec: 600 };
    const CANCEL_BODY_BELOW = { ended_at: '2026-04-09T08:30:30Z', distance_km: 0.1, duration_sec: 30 };

    it('hard-deletes trip when distance is below threshold', async () => {
      TripService.deleteTrip.mockResolvedValue({ error: null, count: 1 });

      const req = mockReq({ params: { id: 'trip-1' }, body: CANCEL_BODY_BELOW });
      const res = mockRes();

      await TripController.cancelTrip(req, res);

      expect(TripService.deleteTrip).toHaveBeenCalledWith('trip-1', 'user-uuid-1');
      expect(TripService.cancelTrip).not.toHaveBeenCalled();
      expect(res._status).toBe(200);
      expect(res._json.data.deleted).toBe(true);
    });

    it('returns 404 when below threshold and no rows deleted', async () => {
      TripService.deleteTrip.mockResolvedValue({ error: null, count: 0 });

      const req = mockReq({ params: { id: 'trip-1' }, body: CANCEL_BODY_BELOW });
      const res = mockRes();

      await TripController.cancelTrip(req, res);

      expect(res._status).toBe(404);
      expect(res._json.error).toBe('Trip not found or not active');
    });

    it('marks trip cancelled and returns it when distance is above threshold', async () => {
      const cancelled = { ...FAKE_TRIP, status: 'cancelled', ...CANCEL_BODY_ABOVE };
      TripService.cancelTrip.mockResolvedValue({ data: cancelled, error: null });

      const req = mockReq({ params: { id: 'trip-1' }, body: CANCEL_BODY_ABOVE });
      const res = mockRes();

      await TripController.cancelTrip(req, res);

      expect(TripService.cancelTrip).toHaveBeenCalledWith('trip-1', 'user-uuid-1', CANCEL_BODY_ABOVE);
      expect(TripService.deleteTrip).not.toHaveBeenCalled();
      expect(res._status).toBe(200);
      expect(res._json.data.status).toBe('cancelled');
    });

    it('returns 404 when above threshold but trip is not active', async () => {
      TripService.cancelTrip.mockResolvedValue({ data: null, error: { message: 'no rows' } });

      const req = mockReq({ params: { id: 'trip-1' }, body: CANCEL_BODY_ABOVE });
      const res = mockRes();

      await TripController.cancelTrip(req, res);

      expect(res._status).toBe(404);
      expect(res._json.error).toBe('Trip not found or not active');
    });
  });

  // --- endTrip ---
  describe('endTrip', () => {
    it('returns 200 immediately and triggers background processing', async () => {
      const ended = { ...FAKE_TRIP, status: 'ended', ended_at: '2026-04-09T09:00:00Z', distance_km: 5, duration_sec: 3600 };
      TripService.endTrip.mockResolvedValue({ data: ended, error: null });

      const req = mockReq({
        params: { id: 'trip-1' },
        body: { ended_at: '2026-04-09T09:00:00Z', distance_km: 5, duration_sec: 3600 },
      });
      const res = mockRes();

      await TripController.endTrip(req, res);

      expect(res._status).toBe(200);
      expect(res._json.data.status).toBe('ended');
    });

    it('returns 404 when trip not found or already ended', async () => {
      TripService.endTrip.mockResolvedValue({ data: null, error: null });

      const req = mockReq({
        params: { id: 'trip-1' },
        body: { ended_at: '2026-04-09T09:00:00Z', distance_km: 5, duration_sec: 3600 },
      });
      const res = mockRes();

      await TripController.endTrip(req, res);

      expect(res._status).toBe(404);
      expect(res._json.error).toBe('Trip not found or already ended');
    });
  });

  // --- updateTrip ---
  describe('updateTrip', () => {
    it('returns 200 with updated trip', async () => {
      const updated = { ...FAKE_TRIP, route_polyline: 'newPoly' };
      TripService.update.mockResolvedValue({ data: updated, error: null });

      const req = mockReq({ params: { id: 'trip-1' }, body: { route_polyline: 'newPoly' } });
      const res = mockRes();

      await TripController.updateTrip(req, res);

      expect(res._status).toBe(200);
      expect(res._json.data.route_polyline).toBe('newPoly');
    });
  });
});
