import crypto from 'node:crypto';
import jwt, { type JwtPayload } from 'jsonwebtoken';
import moment, { type Moment } from 'moment';
import type { Prisma, Token, TokenType } from '../generated/prisma/client.js';
import config from '../config/config.js';
import { prisma } from '../config/database.js';
import { tokenTypes, type TokenTypeValue } from '../config/tokens.js';
import type { PublicUser } from '../utils/user.js';

type StoredTokenType = Exclude<TokenTypeValue, typeof tokenTypes.ACCESS>;
type DbClient = typeof prisma | Prisma.TransactionClient;

const hashToken = (token: string) => {
  return crypto.createHmac('sha256', config.jwt.secret).update(token).digest('hex');
};

/**
 * Generate token
 * @param {ObjectId} userId
 * @param {Moment} expires
 * @param {string} type
 * @param {string} [secret]
 * @returns {string}
 */
const generateToken = (
  userId: string,
  expires: Moment,
  type: TokenTypeValue = tokenTypes.ACCESS,
  secret = config.jwt.secret,
) => {
  const payload = {
    sub: userId,
    iat: moment().unix(),
    exp: expires.unix(),
    type,
  };
  return jwt.sign(payload, secret, { algorithm: 'HS256' });
};

/**
 * Save a token
 * @param {string} token
 * @param {ObjectId} userId
 * @param {Moment} expires
 * @param {string} type
 * @param {boolean} [blacklisted]
 * @returns {Promise<Token>}
 */
const saveToken = async (
  token: string,
  userId: string,
  expires: Moment,
  type: StoredTokenType,
  blacklisted = false,
): Promise<Token> => {
  return prisma.token.create({
    data: {
      token: hashToken(token),
      userId,
      expires: expires.toDate(),
      type: type as TokenType,
      blacklisted,
    },
  });
};

/**
 * Verify token and return token doc (or throw an error if it is not valid)
 * @param {string} token
 * @param {string} type
 * @returns {Promise<Token>}
 */
const verifyToken = async (token: string, type: StoredTokenType): Promise<Token> => {
  const payload = jwt.verify(token, config.jwt.secret, { algorithms: ['HS256'] }) as JwtPayload;
  const tokenHash = hashToken(token);
  const tokenDoc = await prisma.token.findFirst({
    where: {
      token: tokenHash,
      type: type as TokenType,
      userId: payload.sub as string,
      blacklisted: false,
    },
  });
  if (!tokenDoc) {
    throw new Error('Token not found');
  }
  return tokenDoc;
};

/**
 * Generate access token
 * @param {User} user
 * @returns {Object}
 */
const generateAccessToken = (user: PublicUser) => {
  const accessTokenExpires = moment().add(config.jwt.accessExpirationMinutes, 'minutes');
  const accessToken = generateToken(user.id, accessTokenExpires, tokenTypes.ACCESS);

  return {
    token: accessToken,
    expires: accessTokenExpires.toDate(),
  };
};

/**
 * Generate auth tokens
 * @param {User} user
 * @returns {Promise<Object>}
 */
const generateAuthTokens = async (user: PublicUser) => {
  const accessToken = generateAccessToken(user);

  const refreshTokenExpires = moment().add(config.jwt.refreshExpirationDays, 'days');
  const refreshToken = generateToken(user.id, refreshTokenExpires, tokenTypes.REFRESH);
  await saveToken(refreshToken, user.id, refreshTokenExpires, tokenTypes.REFRESH);

  return {
    access: accessToken,
    refresh: {
      token: refreshToken,
      expires: refreshTokenExpires.toDate(),
    },
  };
};

/**
 * Revoke every persisted session secret of a user (refresh tokens and pending login OTPs).
 * Call inside the same transaction that changes the password or disables the account.
 * @param {string} userId
 * @param {DbClient} [db]
 * @returns {Promise<void>}
 */
const revokeUserSessions = async (userId: string, db: DbClient = prisma) => {
  await db.token.deleteMany({ where: { userId } });
  await db.loginOtp.deleteMany({ where: { userId, consumedAt: null } });
};

export { generateToken, hashToken, saveToken, verifyToken, generateAccessToken, generateAuthTokens, revokeUserSessions };
