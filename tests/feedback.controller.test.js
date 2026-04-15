'use strict';

const { mockReq, mockRes } = require('./helpers');

jest.mock('@database', () => ({
  anonClient: {}, serviceClient: {}, models: {},
}));
jest.mock('@services', () => ({
  FeedbackEventService: { getByTripId: jest.fn(), getById: jest.fn(), acknowledge: jest.fn() },
  TripService:          { getById: jest.fn() },
}));

const { FeedbackEventService, TripService } = require('@services');
const FeedbackController = require('@controllers/Feedback.controller');

const FAKE_EVENT = {
  id: 'fb1', trip_id: 't1', segment_id: 's1',
  event_type: 'harsh_accel', message: 'Ease off the gas',
  triggered_at: '2026-04-09T08:31:05Z', acknowledged: false,
};

describe('Feedback Controller', () => {
  afterEach(() => jest.clearAllMocks());

  describe('getFeedbackByTrip', () => {
    it('returns 200 with feedback events', async () => {
      TripService.getById.mockResolvedValue({ data: { id: 't1' }, error: null });
      FeedbackEventService.getByTripId.mockResolvedValue({ data: [FAKE_EVENT], error: null });

      const req = mockReq({ params: { tripId: 't1' } });
      const res = mockRes();

      await FeedbackController.getFeedbackByTrip(req, res);

      expect(res._status).toBe(200);
      expect(res._json.data).toHaveLength(1);
      expect(res._json.data[0].event_type).toBe('harsh_accel');
    });

    it('returns 404 when trip not found', async () => {
      TripService.getById.mockResolvedValue({ data: null, error: null });

      const req = mockReq({ params: { tripId: 'nope' } });
      const res = mockRes();

      await FeedbackController.getFeedbackByTrip(req, res);

      expect(res._status).toBe(404);
    });
  });

  describe('acknowledgeFeedback', () => {
    it('returns 200 with acknowledged event', async () => {
      FeedbackEventService.getById.mockResolvedValue({ data: FAKE_EVENT, error: null });
      TripService.getById.mockResolvedValue({ data: { id: 't1' }, error: null });
      FeedbackEventService.acknowledge.mockResolvedValue({ data: { ...FAKE_EVENT, acknowledged: true }, error: null });

      const req = mockReq({ params: { id: 'fb1' } });
      const res = mockRes();

      await FeedbackController.acknowledgeFeedback(req, res);

      expect(res._status).toBe(200);
      expect(res._json.data.acknowledged).toBe(true);
    });

    it('returns 404 when event not found', async () => {
      FeedbackEventService.getById.mockResolvedValue({ data: null, error: null });

      const req = mockReq({ params: { id: 'nope' } });
      const res = mockRes();

      await FeedbackController.acknowledgeFeedback(req, res);

      expect(res._status).toBe(404);
    });

    it('returns 404 when trip does not belong to user', async () => {
      FeedbackEventService.getById.mockResolvedValue({ data: FAKE_EVENT, error: null });
      TripService.getById.mockResolvedValue({ data: null, error: null });

      const req = mockReq({ params: { id: 'fb1' } });
      const res = mockRes();

      await FeedbackController.acknowledgeFeedback(req, res);

      expect(res._status).toBe(404);
    });
  });
});
