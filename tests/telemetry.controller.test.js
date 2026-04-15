'use strict';

const { mockReq, mockRes } = require('./helpers');

jest.mock('@database', () => ({
  anonClient: {}, serviceClient: {}, models: {},
}));
jest.mock('@services', () => ({
  TelemetryService:     { bulkInsert: jest.fn(), getByTripId: jest.fn() },
  TripService:          { getById: jest.fn() },
  SegmentService:       { bulkInsert: jest.fn() },
  FeedbackEventService: { bulkInsertFromSegments: jest.fn() },
}));
jest.mock('@helpers/MlService.helper', () => ({
  analyseSegment: jest.fn(),
}));
jest.mock('@utils/Logger.util', () => ({
  info: jest.fn(), warn: jest.fn(), error: jest.fn(),
}));

const { TelemetryService, TripService } = require('@services');
const TelemetryController = require('@controllers/Telemetry.controller');

describe('Telemetry Controller', () => {
  afterEach(() => jest.clearAllMocks());

  describe('bulkInsertTelemetry', () => {
    it('returns 201 with inserted count on success', async () => {
      TripService.getById.mockResolvedValue({ data: { id: 't1', status: 'active' }, error: null });
      TelemetryService.bulkInsert.mockResolvedValue({ data: [{}, {}], error: null });

      const req = mockReq({
        body: {
          trip_id: 't1',
          points: [
            { recorded_at: '2026-04-09T08:30:01Z', lat: 3.13, lng: 101.68 },
            { recorded_at: '2026-04-09T08:30:02Z', lat: 3.14, lng: 101.69 },
          ],
        },
      });
      const res = mockRes();

      await TelemetryController.bulkInsertTelemetry(req, res);

      expect(res._status).toBe(201);
      expect(res._json.data.inserted).toBe(2);
    });

    it('returns 404 when trip not found', async () => {
      TripService.getById.mockResolvedValue({ data: null, error: null });

      const req = mockReq({ body: { trip_id: 'nope', points: [] } });
      const res = mockRes();

      await TelemetryController.bulkInsertTelemetry(req, res);

      expect(res._status).toBe(404);
      expect(res._json.error).toBe('Trip not found');
    });

    it('returns 409 when trip is not active', async () => {
      TripService.getById.mockResolvedValue({ data: { id: 't1', status: 'ended' }, error: null });

      const req = mockReq({ body: { trip_id: 't1', points: [] } });
      const res = mockRes();

      await TelemetryController.bulkInsertTelemetry(req, res);

      expect(res._status).toBe(409);
      expect(res._json.error).toContain('not active');
    });
  });

  describe('getTelemetryByTrip', () => {
    it('returns 200 with telemetry points', async () => {
      TripService.getById.mockResolvedValue({ data: { id: 't1' }, error: null });
      TelemetryService.getByTripId.mockResolvedValue({ data: [{ id: 1, lat: 3.13 }], error: null });

      const req = mockReq({ params: { tripId: 't1' } });
      const res = mockRes();

      await TelemetryController.getTelemetryByTrip(req, res);

      expect(res._status).toBe(200);
      expect(res._json.data).toHaveLength(1);
    });

    it('returns 404 when trip not found', async () => {
      TripService.getById.mockResolvedValue({ data: null, error: null });

      const req = mockReq({ params: { tripId: 'nope' } });
      const res = mockRes();

      await TelemetryController.getTelemetryByTrip(req, res);

      expect(res._status).toBe(404);
    });
  });
});
