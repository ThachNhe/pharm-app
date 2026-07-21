import type { Request, Response } from 'express';
import config from '../config/config.js';

const refreshTokenCookieName = 'refreshToken';

const parseCookies = (cookieHeader?: string) => {
  if (!cookieHeader) return {};

  return cookieHeader.split(';').reduce<Record<string, string>>((cookies, part) => {
    const [rawName, ...rawValue] = part.trim().split('=');
    if (!rawName || !rawValue.length) return cookies;
    cookies[rawName] = decodeURIComponent(rawValue.join('='));
    return cookies;
  }, {});
};

const getCookie = (req: Request, name: string) => {
  return parseCookies(req.headers.cookie)[name];
};

const setRefreshTokenCookie = (res: Response, token: string, expires: Date) => {
  res.cookie(refreshTokenCookieName, token, {
    httpOnly: true,
    secure: config.env === 'production',
    sameSite: 'lax',
    expires,
    path: '/v1/auth',
  });
};

const clearRefreshTokenCookie = (res: Response) => {
  res.clearCookie(refreshTokenCookieName, {
    httpOnly: true,
    secure: config.env === 'production',
    sameSite: 'lax',
    path: '/v1/auth',
  });
};

const getRefreshTokenFromRequest = (req: Request) => {
  return (req.body?.refreshToken as string | undefined) ?? getCookie(req, refreshTokenCookieName);
};

export { clearRefreshTokenCookie, getRefreshTokenFromRequest, setRefreshTokenCookie };
