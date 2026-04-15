'use strict';

const { mockReq, mockRes } = require('./helpers');

jest.mock('@database', () => ({
  anonClient: { auth: { getUser: jest.fn() } },
  serviceClient: {},
  models: {},
}));

const { anonClient } = require('@database');
const { requireAuth } = require('@middleware');

describe('Auth Middleware', () => {
  afterEach(() => jest.clearAllMocks());

  it('returns 401 when no Authorization header', async () => {
    const req = mockReq({ headers: {}, user: undefined });
    const res = mockRes();
    const next = jest.fn();

    await requireAuth(req, res, next);

    expect(res._status).toBe(401);
    expect(res._json.error).toContain('Missing');
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 401 when header does not start with Bearer', async () => {
    const req = mockReq({ headers: { authorization: 'Basic abc' }, user: undefined });
    const res = mockRes();
    const next = jest.fn();

    await requireAuth(req, res, next);

    expect(res._status).toBe(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 401 when token is invalid', async () => {
    anonClient.auth.getUser.mockResolvedValue({ data: { user: null }, error: { message: 'bad token' } });

    const req = mockReq({ headers: { authorization: 'Bearer bad-token' }, user: undefined });
    const res = mockRes();
    const next = jest.fn();

    await requireAuth(req, res, next);

    expect(res._status).toBe(401);
    expect(res._json.error).toContain('Invalid');
    expect(next).not.toHaveBeenCalled();
  });

  it('sets req.user and calls next on valid token', async () => {
    const fakeUser = { id: 'u1', email: 'a@b.com' };
    anonClient.auth.getUser.mockResolvedValue({ data: { user: fakeUser }, error: null });

    const req = mockReq({ headers: { authorization: 'Bearer valid-token' }, user: undefined });
    const res = mockRes();
    const next = jest.fn();

    await requireAuth(req, res, next);

    expect(req.user).toEqual(fakeUser);
    expect(next).toHaveBeenCalled();
  });
});
