'use strict';

const { mockReq, mockRes } = require('./helpers');

jest.mock('@database', () => ({
  anonClient: {}, serviceClient: {}, models: {},
}));
jest.mock('@services', () => ({
  VehicleService: {
    create: jest.fn(), getByUserId: jest.fn(), getById: jest.fn(),
    update: jest.fn(), setDefault: jest.fn(), remove: jest.fn(),
  },
}));

// Mock the vehicle-makes.json data file
jest.mock('../app/data/vehicle-makes.json', () => [
  {
    make: 'Toyota',
    models: [
      { model: 'Corolla', variants: [{ variant: '1.8L', year: 2024, vehicle_type: 'petrol', vehicle_mass_kg: 1350, drag_coefficient: 0.29, drivetrain_type: 'fwd' }] },
      { model: 'Camry', variants: [] },
    ],
  },
  { make: 'Honda', models: [{ model: 'Civic', variants: [] }] },
], { virtual: true });

const { VehicleService } = require('@services');
const VehicleController = require('@controllers/Vehicle.controller');

const FAKE_VEHICLE = {
  id: 'v1', user_id: 'user-uuid-1', make: 'Toyota', model: 'Corolla', year: 2024,
  vehicle_type: 'petrol', vehicle_mass_kg: 1350, drag_coefficient: 0.29,
  drivetrain_type: 'fwd', is_default: true,
  created_at: '2026-04-09T10:00:00Z', updated_at: '2026-04-09T10:00:00Z',
};

describe('Vehicle Controller', () => {
  afterEach(() => jest.clearAllMocks());

  describe('createVehicle', () => {
    it('returns 201 and sets first vehicle as default', async () => {
      VehicleService.getByUserId.mockResolvedValue({ data: [] });
      VehicleService.create.mockResolvedValue({ data: FAKE_VEHICLE, error: null });

      const req = mockReq({ body: { make: 'Toyota', model: 'Corolla', year: 2024, vehicle_type: 'petrol', drivetrain_type: 'fwd' } });
      const res = mockRes();

      await VehicleController.createVehicle(req, res);

      expect(res._status).toBe(201);
      expect(VehicleService.create).toHaveBeenCalledWith(
        'user-uuid-1',
        expect.objectContaining({ is_default: true }),
      );
    });

    it('does not set default when user already has vehicles', async () => {
      VehicleService.getByUserId.mockResolvedValue({ data: [FAKE_VEHICLE] });
      VehicleService.create.mockResolvedValue({ data: { ...FAKE_VEHICLE, id: 'v2', is_default: false }, error: null });

      const req = mockReq({ body: { make: 'Honda', model: 'Civic', vehicle_type: 'petrol', drivetrain_type: 'fwd' } });
      const res = mockRes();

      await VehicleController.createVehicle(req, res);

      expect(VehicleService.create).toHaveBeenCalledWith(
        'user-uuid-1',
        expect.objectContaining({ is_default: false }),
      );
    });
  });

  describe('getVehicles', () => {
    it('returns user vehicles', async () => {
      VehicleService.getByUserId.mockResolvedValue({ data: [FAKE_VEHICLE], error: null });

      const req = mockReq();
      const res = mockRes();

      await VehicleController.getVehicles(req, res);

      expect(res._status).toBe(200);
      expect(res._json.data).toHaveLength(1);
    });
  });

  describe('getVehicle', () => {
    it('returns 404 when vehicle not found', async () => {
      VehicleService.getById.mockResolvedValue({ data: null, error: { message: 'not found' } });

      const req = mockReq({ params: { id: 'nope' } });
      const res = mockRes();

      await VehicleController.getVehicle(req, res);

      expect(res._status).toBe(404);
    });
  });

  describe('deleteVehicle', () => {
    it('promotes next vehicle when deleting default', async () => {
      const second = { ...FAKE_VEHICLE, id: 'v2', is_default: false };
      VehicleService.getById.mockResolvedValue({ data: { ...FAKE_VEHICLE, is_default: true }, error: null });
      VehicleService.remove.mockResolvedValue({ error: null });
      VehicleService.getByUserId.mockResolvedValue({ data: [second] });
      VehicleService.setDefault.mockResolvedValue({ data: { ...second, is_default: true }, error: null });

      const req = mockReq({ params: { id: 'v1' } });
      const res = mockRes();

      await VehicleController.deleteVehicle(req, res);

      expect(res._status).toBe(200);
      expect(VehicleService.setDefault).toHaveBeenCalledWith('v2', 'user-uuid-1');
    });
  });

  describe('getMakes', () => {
    it('returns paginated list of makes', () => {
      const req = mockReq({ query: { page: '1', limit: '10' } });
      const res = mockRes();

      VehicleController.getMakes(req, res);

      expect(res._status).toBe(200);
      expect(res._json.data.data).toContain('Toyota');
      expect(res._json.data.pagination).toBeDefined();
    });
  });

  describe('getModels', () => {
    it('returns models for a make', () => {
      const req = mockReq({ params: { make: 'Toyota' }, query: {} });
      const res = mockRes();

      VehicleController.getModels(req, res);

      expect(res._json.data.data).toContain('Corolla');
    });

    it('returns 404 for unknown make', () => {
      const req = mockReq({ params: { make: 'Unknown' }, query: {} });
      const res = mockRes();

      VehicleController.getModels(req, res);

      expect(res._status).toBe(404);
    });
  });
});
