'use strict';

const { mockReq, mockRes } = require('./helpers');

// Mock dependencies before requiring the controller
jest.mock('@database', () => ({
  anonClient:    { auth: { signUp: jest.fn(), signInWithPassword: jest.fn() } },
  serviceClient: { auth: { admin: { signOut: jest.fn() } } },
  models:        {},
}));
jest.mock('@services', () => ({
  UserService: { getById: jest.fn() },
}));

const { anonClient, serviceClient } = require('@database');
const { UserService } = require('@services');
const AuthController = require('@controllers/Auth.controller');

describe('Auth Controller', () => {
  afterEach(() => jest.clearAllMocks());

  // --- signUp ---
  describe('signUp', () => {
    it('returns 201 with user and session on success', async () => {
      const fakeUser    = { id: 'u1', email: 'a@b.com', user_metadata: { display_name: 'A' } };
      const fakeSession = { access_token: 'tok', expires_at: 9999 };
      anonClient.auth.signUp.mockResolvedValue({ data: { user: fakeUser, session: fakeSession }, error: null });

      const req = mockReq({ body: { email: 'a@b.com', password: 'pass123', display_name: 'A' } });
      const res = mockRes();

      await AuthController.signUp(req, res);

      expect(res._status).toBe(201);
      expect(res._json.success).toBe(true);
      expect(res._json.data.session.access_token).toBe('tok');
    });

    it('returns 400 when Supabase returns an error', async () => {
      anonClient.auth.signUp.mockResolvedValue({ data: {}, error: { message: 'User already registered' } });

      const req = mockReq({ body: { email: 'a@b.com', password: 'pass' } });
      const res = mockRes();

      await AuthController.signUp(req, res);

      expect(res._status).toBe(400);
      expect(res._json.success).toBe(false);
      expect(res._json.error).toBe('User already registered');
    });
  });

  // --- signIn ---
  describe('signIn', () => {
    it('returns 200 with user and session on success', async () => {
      const fakeUser    = { id: 'u1', email: 'a@b.com' };
      const fakeSession = { access_token: 'tok2', expires_at: 9999 };
      anonClient.auth.signInWithPassword.mockResolvedValue({ data: { user: fakeUser, session: fakeSession }, error: null });

      const req = mockReq({ body: { email: 'a@b.com', password: 'pass123' } });
      const res = mockRes();

      await AuthController.signIn(req, res);

      expect(res._status).toBe(200);
      expect(res._json.success).toBe(true);
      expect(res._json.data.session.access_token).toBe('tok2');
    });

    it('returns 401 on invalid credentials', async () => {
      anonClient.auth.signInWithPassword.mockResolvedValue({ data: {}, error: { message: 'Invalid login credentials' } });

      const req = mockReq({ body: { email: 'a@b.com', password: 'wrong' } });
      const res = mockRes();

      await AuthController.signIn(req, res);

      expect(res._status).toBe(401);
      expect(res._json.error).toBe('Invalid login credentials');
    });
  });

  // --- signOut ---
  describe('signOut', () => {
    it('returns 200 on successful signout', async () => {
      serviceClient.auth.admin.signOut.mockResolvedValue({ error: null });

      const req = mockReq({ headers: { authorization: 'Bearer some-token' } });
      const res = mockRes();

      await AuthController.signOut(req, res);

      expect(res._status).toBe(200);
      expect(res._json.data.message).toBe('Signed out successfully');
    });
  });

  // --- getMe ---
  describe('getMe', () => {
    it('returns 200 with user profile', async () => {
      const fakeProfile = { id: 'u1', email: 'a@b.com', display_name: 'A', role: 'user' };
      UserService.getById.mockResolvedValue({ data: fakeProfile, error: null });

      const req = mockReq();
      const res = mockRes();

      await AuthController.getMe(req, res);

      expect(res._status).toBe(200);
      expect(res._json.data.email).toBe('a@b.com');
    });

    it('returns 404 when profile not found', async () => {
      UserService.getById.mockResolvedValue({ data: null, error: { message: 'Not found' } });

      const req = mockReq();
      const res = mockRes();

      await AuthController.getMe(req, res);

      expect(res._status).toBe(404);
    });
  });
});
