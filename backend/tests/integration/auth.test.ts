import request from 'supertest';
import faker from 'faker';
import httpStatus from 'http-status';
import httpMocks from 'node-mocks-http';
import moment from 'moment';
import app from '../../src/app.js';
import config from '../../src/config/config.js';
import auth from '../../src/middlewares/auth.js';
import { tokenService, emailService } from '../../src/services/index.js';
import { prisma } from '../../src/config/database.js';
import ApiError from '../../src/utils/ApiError.js';
import setupTestDB from '../utils/setupTestDB.js';
import { roleRights } from '../../src/config/roles.js';
import { tokenTypes } from '../../src/config/tokens.js';
import { userOne, admin, insertUsers } from '../fixtures/user.fixture.js';
import { userOneAccessToken, adminAccessToken } from '../fixtures/token.fixture.js';

setupTestDB();

const getSetCookies = (res) => {
  const cookies = res.headers['set-cookie'];
  return Array.isArray(cookies) ? cookies : [cookies].filter(Boolean);
};

const expectRefreshCookie = (res) => {
  expect(getSetCookies(res).some((cookie) => cookie.startsWith('refreshToken=') && cookie.includes('HttpOnly'))).toBe(true);
};

const expectNoRefreshCookie = (res) => {
  expect(getSetCookies(res).some((cookie) => cookie.startsWith('refreshToken='))).toBe(false);
};

const getLoginOtpCode = (sendMailSpy) => {
  const message = sendMailSpy.mock.calls.at(-1)?.[0] as { text?: string };
  return message.text?.match(/\b\d{6}\b/)?.[0];
};

const saveRefreshToken = async (userId: string) => {
  const expires = moment().add(config.jwt.refreshExpirationDays, 'days');
  const refreshToken = tokenService.generateToken(userId, expires, tokenTypes.REFRESH);
  await tokenService.saveToken(refreshToken, userId, expires, tokenTypes.REFRESH);
  return refreshToken;
};

describe('Auth routes', () => {
  test('should not expose public registration', async () => {
    await request(app).post('/v1/auth/register').send({}).expect(httpStatus.NOT_FOUND);
  });

  describe('POST /v1/auth/login', () => {
    beforeEach(() => {
      vi.spyOn(emailService.transport, 'sendMail').mockResolvedValue({} as never);
    });

    test('should return 200 and create a login OTP challenge if email and password match', async () => {
      await insertUsers([userOne]);
      const sendMailSpy = vi.spyOn(emailService.transport, 'sendMail');
      const loginCredentials = {
        email: userOne.email,
        password: userOne.password,
      };

      const res = await request(app).post('/v1/auth/login').send(loginCredentials).expect(httpStatus.OK);

      expect(res.body).toEqual({
        twoFactorRequired: true,
        challengeId: expect.any(String),
        email: userOne.email,
        expiresAt: expect.any(String),
      });
      expect(res.body).not.toHaveProperty('tokens');
      expect(getSetCookies(res)).toEqual([]);
      expect(sendMailSpy).toHaveBeenCalledWith(expect.objectContaining({ to: userOne.email }));

      const otpCode = getLoginOtpCode(sendMailSpy);
      const dbLoginOtp = await prisma.loginOtp.findUnique({
        where: { id: res.body.challengeId },
      });
      const dbRefreshTokenCount = await prisma.token.count();

      expect(otpCode).toMatch(/^\d{6}$/);
      expect(dbLoginOtp).toMatchObject({ userId: userOne.id, consumedAt: null, attempts: 0 });
      expect(dbLoginOtp?.codeHash).not.toBe(otpCode);
      expect(dbRefreshTokenCount).toBe(0);
    });

    test('should return 401 error if there are no users with that email', async () => {
      const loginCredentials = {
        email: userOne.email,
        password: userOne.password,
      };

      const res = await request(app).post('/v1/auth/login').send(loginCredentials).expect(httpStatus.UNAUTHORIZED);

      expect(res.body).toEqual({ code: httpStatus.UNAUTHORIZED, message: 'Incorrect email or password' });
    });

    test('should return 401 error if password is wrong', async () => {
      await insertUsers([userOne]);
      const loginCredentials = {
        email: userOne.email,
        password: 'wrongPassword1',
      };

      const res = await request(app).post('/v1/auth/login').send(loginCredentials).expect(httpStatus.UNAUTHORIZED);

      expect(res.body).toEqual({ code: httpStatus.UNAUTHORIZED, message: 'Incorrect email or password' });
    });
  });

  describe('POST /v1/auth/login (disabled account)', () => {
    test('should return 403 without sending an OTP if the account is disabled', async () => {
      await insertUsers([{ ...userOne, isActive: false }]);
      const sendMailSpy = vi.spyOn(emailService.transport, 'sendMail').mockResolvedValue({} as never);

      await request(app)
        .post('/v1/auth/login')
        .send({ email: userOne.email, password: userOne.password })
        .expect(httpStatus.FORBIDDEN);

      expect(sendMailSpy).not.toHaveBeenCalled();
      expect(await prisma.loginOtp.count()).toBe(0);
    });
  });

  describe('POST /v1/auth/verify-login-otp', () => {
    beforeEach(() => {
      vi.spyOn(emailService.transport, 'sendMail').mockResolvedValue({} as never);
    });

    test('should return 200 and auth tokens if login OTP is valid', async () => {
      await insertUsers([userOne]);
      const sendMailSpy = vi.spyOn(emailService.transport, 'sendMail');

      const loginRes = await request(app)
        .post('/v1/auth/login')
        .send({ email: userOne.email, password: userOne.password })
        .expect(httpStatus.OK);
      const code = getLoginOtpCode(sendMailSpy);

      const res = await request(app)
        .post('/v1/auth/verify-login-otp')
        .send({ challengeId: loginRes.body.challengeId, code })
        .expect(httpStatus.OK);

      expect(res.body).toEqual({
        user: {
          id: expect.anything(),
          name: userOne.name,
          email: userOne.email,
          role: userOne.role,
        },
        tokens: {
          access: { token: expect.anything(), expires: expect.anything() },
        },
      });
      expectRefreshCookie(res);

      const dbLoginOtp = await prisma.loginOtp.findUnique({ where: { id: loginRes.body.challengeId } });
      expect(dbLoginOtp?.consumedAt).toBeDefined();
    });

    test('should return 401 and increment attempts if login OTP is wrong', async () => {
      await insertUsers([userOne]);

      const loginRes = await request(app)
        .post('/v1/auth/login')
        .send({ email: userOne.email, password: userOne.password })
        .expect(httpStatus.OK);

      await request(app)
        .post('/v1/auth/verify-login-otp')
        .send({ challengeId: loginRes.body.challengeId, code: '000000' })
        .expect(httpStatus.UNAUTHORIZED);

      const dbLoginOtp = await prisma.loginOtp.findUnique({ where: { id: loginRes.body.challengeId } });
      expect(dbLoginOtp?.attempts).toBe(1);
      expect(dbLoginOtp?.consumedAt).toBe(null);
    });

    test('should return 401 if login OTP is reused', async () => {
      await insertUsers([userOne]);
      const sendMailSpy = vi.spyOn(emailService.transport, 'sendMail');

      const loginRes = await request(app)
        .post('/v1/auth/login')
        .send({ email: userOne.email, password: userOne.password })
        .expect(httpStatus.OK);
      const code = getLoginOtpCode(sendMailSpy);

      await request(app)
        .post('/v1/auth/verify-login-otp')
        .send({ challengeId: loginRes.body.challengeId, code })
        .expect(httpStatus.OK);

      await request(app)
        .post('/v1/auth/verify-login-otp')
        .send({ challengeId: loginRes.body.challengeId, code })
        .expect(httpStatus.UNAUTHORIZED);
    });

    test('should return 401 if login OTP is expired', async () => {
      await insertUsers([userOne]);
      const challengeId = faker.datatype.uuid();

      await prisma.loginOtp.create({
        data: {
          id: challengeId,
          userId: userOne.id,
          codeHash: 'expired',
          expiresAt: moment().subtract(1, 'minute').toDate(),
        },
      });

      await request(app)
        .post('/v1/auth/verify-login-otp')
        .send({ challengeId, code: '123456' })
        .expect(httpStatus.UNAUTHORIZED);
    });

    test('should not exceed max attempts when wrong codes are sent concurrently', async () => {
      await insertUsers([userOne]);

      const loginRes = await request(app)
        .post('/v1/auth/login')
        .send({ email: userOne.email, password: userOne.password })
        .expect(httpStatus.OK);

      const responses = await Promise.all(
        Array.from({ length: config.otp.maxAttempts * 4 }, () =>
          request(app).post('/v1/auth/verify-login-otp').send({ challengeId: loginRes.body.challengeId, code: '000000' }),
        ),
      );

      expect(responses.every((res) => res.status === httpStatus.UNAUTHORIZED)).toBe(true);
      const dbLoginOtp = await prisma.loginOtp.findUnique({ where: { id: loginRes.body.challengeId } });
      expect(dbLoginOtp?.attempts).toBe(config.otp.maxAttempts);
    });

    test('should reject the correct code once max attempts are used', async () => {
      await insertUsers([userOne]);
      const sendMailSpy = vi.spyOn(emailService.transport, 'sendMail');

      const loginRes = await request(app)
        .post('/v1/auth/login')
        .send({ email: userOne.email, password: userOne.password })
        .expect(httpStatus.OK);
      const code = getLoginOtpCode(sendMailSpy);

      for (let attempt = 0; attempt < config.otp.maxAttempts; attempt += 1) {
        await request(app)
          .post('/v1/auth/verify-login-otp')
          .send({ challengeId: loginRes.body.challengeId, code: '000000' })
          .expect(httpStatus.UNAUTHORIZED);
      }

      const res = await request(app)
        .post('/v1/auth/verify-login-otp')
        .send({ challengeId: loginRes.body.challengeId, code })
        .expect(httpStatus.UNAUTHORIZED);

      expect(res.body.message).toBe('Too many attempts');
      expectNoRefreshCookie(res);
      expect(await prisma.token.count()).toBe(0);
    });

    test('should return 403 without issuing tokens if the account is disabled before OTP verification', async () => {
      await insertUsers([userOne]);
      const sendMailSpy = vi.spyOn(emailService.transport, 'sendMail');

      const loginRes = await request(app)
        .post('/v1/auth/login')
        .send({ email: userOne.email, password: userOne.password })
        .expect(httpStatus.OK);
      const code = getLoginOtpCode(sendMailSpy);
      await prisma.user.update({ where: { id: userOne.id }, data: { isActive: false } });

      const res = await request(app)
        .post('/v1/auth/verify-login-otp')
        .send({ challengeId: loginRes.body.challengeId, code })
        .expect(httpStatus.FORBIDDEN);

      expectNoRefreshCookie(res);
      expect(await prisma.token.count()).toBe(0);
    });

    test('should return 400 if login OTP payload is invalid', async () => {
      await request(app)
        .post('/v1/auth/verify-login-otp')
        .send({ challengeId: 'not-a-uuid', code: '123' })
        .expect(httpStatus.BAD_REQUEST);
    });
  });

  describe('POST /v1/auth/logout', () => {
    test('should return 204 if refresh token is valid', async () => {
      await insertUsers([userOne]);
      const expires = moment().add(config.jwt.refreshExpirationDays, 'days');
      const refreshToken = tokenService.generateToken(userOne.id, expires, tokenTypes.REFRESH);
      await tokenService.saveToken(refreshToken, userOne.id, expires, tokenTypes.REFRESH);

      const res = await request(app)
        .post('/v1/auth/logout')
        .set('Cookie', [`refreshToken=${refreshToken}`])
        .expect(httpStatus.NO_CONTENT);
      expectRefreshCookie(res);

      const dbRefreshTokenDoc = await prisma.token.findFirst({ where: { token: tokenService.hashToken(refreshToken) } });
      expect(dbRefreshTokenDoc).toBe(null);
    });

    test('should return 204 if refresh token is missing', async () => {
      await request(app).post('/v1/auth/logout').send().expect(httpStatus.NO_CONTENT);
    });

    test('should return 204 if refresh token is not found in the database', async () => {
      await insertUsers([userOne]);
      const expires = moment().add(config.jwt.refreshExpirationDays, 'days');
      const refreshToken = tokenService.generateToken(userOne.id, expires, tokenTypes.REFRESH);

      await request(app)
        .post('/v1/auth/logout')
        .set('Cookie', [`refreshToken=${refreshToken}`])
        .expect(httpStatus.NO_CONTENT);
    });

    test('should return 204 if refresh token is blacklisted', async () => {
      await insertUsers([userOne]);
      const expires = moment().add(config.jwt.refreshExpirationDays, 'days');
      const refreshToken = tokenService.generateToken(userOne.id, expires, tokenTypes.REFRESH);
      await tokenService.saveToken(refreshToken, userOne.id, expires, tokenTypes.REFRESH, true);

      await request(app)
        .post('/v1/auth/logout')
        .set('Cookie', [`refreshToken=${refreshToken}`])
        .expect(httpStatus.NO_CONTENT);
    });
  });

  describe('POST /v1/auth/refresh-tokens', () => {
    test('should return 200 and a new access token without rotating refresh token if refresh token is valid', async () => {
      await insertUsers([userOne]);
      const expires = moment().add(config.jwt.refreshExpirationDays, 'days');
      const refreshToken = tokenService.generateToken(userOne.id, expires, tokenTypes.REFRESH);
      await tokenService.saveToken(refreshToken, userOne.id, expires, tokenTypes.REFRESH);

      const res = await request(app)
        .post('/v1/auth/refresh-tokens')
        .set('Cookie', [`refreshToken=${refreshToken}`])
        .expect(httpStatus.OK);

      expect(res.body).toEqual({
        user: {
          id: expect.anything(),
          name: userOne.name,
          email: userOne.email,
          role: userOne.role,
        },
        tokens: {
          access: { token: expect.anything(), expires: expect.anything() },
        },
      });
      expectNoRefreshCookie(res);

      const dbRefreshTokenDoc = await prisma.token.findFirst({
        where: { token: tokenService.hashToken(refreshToken) },
      });
      expect(dbRefreshTokenDoc).toMatchObject({ type: tokenTypes.REFRESH, userId: userOne.id, blacklisted: false });

      const dbRefreshTokenCount = await prisma.token.count();
      expect(dbRefreshTokenCount).toBe(1);
    });

    test('should return 401 error if refresh token is missing', async () => {
      await request(app).post('/v1/auth/refresh-tokens').send().expect(httpStatus.UNAUTHORIZED);
    });

    test('should reject a refresh token sent in the request body', async () => {
      await request(app)
        .post('/v1/auth/refresh-tokens')
        .send({ refreshToken: 'must-only-be-read-from-cookie' })
        .expect(httpStatus.BAD_REQUEST);
    });

    test('should return 401 error if refresh token is signed using an invalid secret', async () => {
      await insertUsers([userOne]);
      const expires = moment().add(config.jwt.refreshExpirationDays, 'days');
      const refreshToken = tokenService.generateToken(userOne.id, expires, tokenTypes.REFRESH, 'invalidSecret');
      await tokenService.saveToken(refreshToken, userOne.id, expires, tokenTypes.REFRESH);

      await request(app)
        .post('/v1/auth/refresh-tokens')
        .set('Cookie', [`refreshToken=${refreshToken}`])
        .expect(httpStatus.UNAUTHORIZED);
    });

    test('should return 401 error if refresh token is not found in the database', async () => {
      await insertUsers([userOne]);
      const expires = moment().add(config.jwt.refreshExpirationDays, 'days');
      const refreshToken = tokenService.generateToken(userOne.id, expires, tokenTypes.REFRESH);

      await request(app)
        .post('/v1/auth/refresh-tokens')
        .set('Cookie', [`refreshToken=${refreshToken}`])
        .expect(httpStatus.UNAUTHORIZED);
    });

    test('should return 401 error if refresh token is blacklisted', async () => {
      await insertUsers([userOne]);
      const expires = moment().add(config.jwt.refreshExpirationDays, 'days');
      const refreshToken = tokenService.generateToken(userOne.id, expires, tokenTypes.REFRESH);
      await tokenService.saveToken(refreshToken, userOne.id, expires, tokenTypes.REFRESH, true);

      await request(app)
        .post('/v1/auth/refresh-tokens')
        .set('Cookie', [`refreshToken=${refreshToken}`])
        .expect(httpStatus.UNAUTHORIZED);
    });

    test('should return 401 error if refresh token is expired', async () => {
      await insertUsers([userOne]);
      const expires = moment().subtract(1, 'minutes');
      const refreshToken = tokenService.generateToken(userOne.id, expires);
      await tokenService.saveToken(refreshToken, userOne.id, expires, tokenTypes.REFRESH);

      await request(app)
        .post('/v1/auth/refresh-tokens')
        .set('Cookie', [`refreshToken=${refreshToken}`])
        .expect(httpStatus.UNAUTHORIZED);
    });

    test('should return 401 error if user is disabled', async () => {
      await insertUsers([{ ...userOne, isActive: false }]);
      const refreshToken = await saveRefreshToken(userOne.id);

      await request(app)
        .post('/v1/auth/refresh-tokens')
        .set('Cookie', [`refreshToken=${refreshToken}`])
        .expect(httpStatus.UNAUTHORIZED);
    });

    test('should return 401 error if user is not found', async () => {
      await insertUsers([userOne]);
      const expires = moment().add(config.jwt.refreshExpirationDays, 'days');
      const refreshToken = tokenService.generateToken(userOne.id, expires, tokenTypes.REFRESH);
      await tokenService.saveToken(refreshToken, userOne.id, expires, tokenTypes.REFRESH);
      await prisma.user.delete({ where: { id: userOne.id } });

      await request(app)
        .post('/v1/auth/refresh-tokens')
        .set('Cookie', [`refreshToken=${refreshToken}`])
        .expect(httpStatus.UNAUTHORIZED);
    });
  });

  test.each([
    '/v1/auth/forgot-password',
    '/v1/auth/reset-password',
    '/v1/auth/send-verification-email',
    '/v1/auth/verify-email',
  ])('should not expose removed email endpoint %s', async (endpoint) => {
    await request(app).post(endpoint).send({}).expect(httpStatus.NOT_FOUND);
  });
});

describe('Auth middleware', () => {
  test('should call next with no errors if access token is valid', async () => {
    await insertUsers([userOne]);
    const req = httpMocks.createRequest({ headers: { Authorization: `Bearer ${userOneAccessToken}` } });
    const next = vi.fn();

    await auth()(req, httpMocks.createResponse(), next);

    expect(next).toHaveBeenCalledWith();
    expect(req.user.id).toEqual(userOne.id);
  });

  test('should call next with unauthorized error if access token is not found in header', async () => {
    await insertUsers([userOne]);
    const req = httpMocks.createRequest();
    const next = vi.fn();

    await auth()(req, httpMocks.createResponse(), next);

    expect(next).toHaveBeenCalledWith(expect.any(ApiError));
    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({ statusCode: httpStatus.UNAUTHORIZED, message: 'Please authenticate' }),
    );
  });

  test('should call next with unauthorized error if access token is not a valid jwt token', async () => {
    await insertUsers([userOne]);
    const req = httpMocks.createRequest({ headers: { Authorization: 'Bearer randomToken' } });
    const next = vi.fn();

    await auth()(req, httpMocks.createResponse(), next);

    expect(next).toHaveBeenCalledWith(expect.any(ApiError));
    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({ statusCode: httpStatus.UNAUTHORIZED, message: 'Please authenticate' }),
    );
  });

  test('should call next with unauthorized error if the token is not an access token', async () => {
    await insertUsers([userOne]);
    const expires = moment().add(config.jwt.accessExpirationMinutes, 'minutes');
    const refreshToken = tokenService.generateToken(userOne.id, expires, tokenTypes.REFRESH);
    const req = httpMocks.createRequest({ headers: { Authorization: `Bearer ${refreshToken}` } });
    const next = vi.fn();

    await auth()(req, httpMocks.createResponse(), next);

    expect(next).toHaveBeenCalledWith(expect.any(ApiError));
    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({ statusCode: httpStatus.UNAUTHORIZED, message: 'Please authenticate' }),
    );
  });

  test('should call next with unauthorized error if access token is generated with an invalid secret', async () => {
    await insertUsers([userOne]);
    const expires = moment().add(config.jwt.accessExpirationMinutes, 'minutes');
    const accessToken = tokenService.generateToken(userOne.id, expires, tokenTypes.ACCESS, 'invalidSecret');
    const req = httpMocks.createRequest({ headers: { Authorization: `Bearer ${accessToken}` } });
    const next = vi.fn();

    await auth()(req, httpMocks.createResponse(), next);

    expect(next).toHaveBeenCalledWith(expect.any(ApiError));
    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({ statusCode: httpStatus.UNAUTHORIZED, message: 'Please authenticate' }),
    );
  });

  test('should call next with unauthorized error if access token is expired', async () => {
    await insertUsers([userOne]);
    const expires = moment().subtract(1, 'minutes');
    const accessToken = tokenService.generateToken(userOne.id, expires, tokenTypes.ACCESS);
    const req = httpMocks.createRequest({ headers: { Authorization: `Bearer ${accessToken}` } });
    const next = vi.fn();

    await auth()(req, httpMocks.createResponse(), next);

    expect(next).toHaveBeenCalledWith(expect.any(ApiError));
    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({ statusCode: httpStatus.UNAUTHORIZED, message: 'Please authenticate' }),
    );
  });

  test('should call next with unauthorized error if user is not found', async () => {
    const req = httpMocks.createRequest({ headers: { Authorization: `Bearer ${userOneAccessToken}` } });
    const next = vi.fn();

    await auth()(req, httpMocks.createResponse(), next);

    expect(next).toHaveBeenCalledWith(expect.any(ApiError));
    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({ statusCode: httpStatus.UNAUTHORIZED, message: 'Please authenticate' }),
    );
  });

  test('should call next with unauthorized error if user is disabled', async () => {
    await insertUsers([{ ...userOne, isActive: false }]);
    const req = httpMocks.createRequest({ headers: { Authorization: `Bearer ${userOneAccessToken}` } });
    const next = vi.fn();

    await auth()(req, httpMocks.createResponse(), next);

    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({ statusCode: httpStatus.UNAUTHORIZED, message: 'Please authenticate' }),
    );
  });

  test('should call next with forbidden error if user does not have required rights and userId is not in params', async () => {
    await insertUsers([userOne]);
    const req = httpMocks.createRequest({ headers: { Authorization: `Bearer ${userOneAccessToken}` } });
    const next = vi.fn();

    await auth('anyRight')(req, httpMocks.createResponse(), next);

    expect(next).toHaveBeenCalledWith(expect.any(ApiError));
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: httpStatus.FORBIDDEN, message: 'Forbidden' }));
  });

  test('should call next with no errors if user does not have required rights but userId is in params', async () => {
    await insertUsers([userOne]);
    const req = httpMocks.createRequest({
      headers: { Authorization: `Bearer ${userOneAccessToken}` },
      params: { userId: userOne.id },
    });
    const next = vi.fn();

    await auth('anyRight')(req, httpMocks.createResponse(), next);

    expect(next).toHaveBeenCalledWith();
  });

  test('should call next with no errors if user has required rights', async () => {
    await insertUsers([admin]);
    const req = httpMocks.createRequest({
      headers: { Authorization: `Bearer ${adminAccessToken}` },
      params: { userId: userOne.id },
    });
    const next = vi.fn();

    await auth(...roleRights.get('admin'))(req, httpMocks.createResponse(), next);

    expect(next).toHaveBeenCalledWith();
  });
});
