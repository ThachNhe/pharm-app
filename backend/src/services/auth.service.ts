import bcrypt from 'bcryptjs';
import httpStatus from 'http-status';
import * as tokenService from './token.service.js';
import * as userService from './user.service.js';
import * as loginOtpService from './loginOtp.service.js';
import { prisma } from '../config/database.js';
import ApiError from '../utils/ApiError.js';
import { tokenTypes } from '../config/tokens.js';
import { publicUserSelect } from '../utils/user.js';

/**
 * Login with username and password
 * @param {string} email
 * @param {string} password
 * @returns {Promise<User>}
 */
const loginUserWithEmailAndPassword = async (email: string, password: string) => {
  const user = await userService.getUserByEmail(email);
  if (!user || !(await bcrypt.compare(password, user.password))) {
    throw new ApiError(httpStatus.UNAUTHORIZED, 'Incorrect email or password');
  }
  if (!user.isActive) {
    throw new ApiError(httpStatus.FORBIDDEN, 'Account is disabled');
  }

  const challenge = await loginOtpService.createLoginOtp(user.id, user.email);

  return {
    twoFactorRequired: true,
    challengeId: challenge.id,
    email: user.email,
    expiresAt: challenge.expiresAt,
  };
};

/**
 * Logout
 * @param {string} refreshToken
 * @returns {Promise}
 */
const logout = async (refreshToken?: string) => {
  if (!refreshToken) {
    return;
  }

  const refreshTokenDoc = await prisma.token.findFirst({
    where: {
      token: tokenService.hashToken(refreshToken),
      type: tokenTypes.REFRESH,
      blacklisted: false,
    },
  });
  if (refreshTokenDoc) {
    await prisma.token.delete({ where: { id: refreshTokenDoc.id } });
  }
};

/**
 * Refresh access token using the current refresh token cookie
 * @param {string} refreshToken
 * @returns {Promise<Object>}
 */
const refreshAuth = async (refreshToken?: string) => {
  try {
    if (!refreshToken) {
      throw new Error();
    }
    const refreshTokenDoc = await tokenService.verifyToken(refreshToken, tokenTypes.REFRESH);
    const authUser = await prisma.user.findUnique({
      where: { id: refreshTokenDoc.userId },
      select: { ...publicUserSelect, isActive: true },
    });
    if (!authUser || !authUser.isActive) {
      throw new Error();
    }
    const { isActive: _isActive, ...user } = authUser;
    const access = tokenService.generateAccessToken(user);
    return { user, tokens: { access } };
  } catch (error) {
    throw new ApiError(httpStatus.UNAUTHORIZED, 'Please authenticate');
  }
};

export { loginUserWithEmailAndPassword, logout, refreshAuth };
