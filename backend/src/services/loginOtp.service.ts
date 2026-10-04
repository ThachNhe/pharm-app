import crypto from 'node:crypto';
import httpStatus from 'http-status';
import { prisma } from '../config/database.js';
import config from '../config/config.js';
import ApiError from '../utils/ApiError.js';
import { publicUserSelect, type PublicUser } from '../utils/user.js';
import * as emailService from './email.service.js';

type LoginOtpChallenge = {
  id: string;
  email: string;
  expiresAt: Date;
};

const hashOtp = (challengeId: string, code: string) => {
  return crypto.createHmac('sha256', config.jwt.secret).update(`${challengeId}:${code}`).digest('hex');
};

const createCode = () => {
  return crypto.randomInt(100000, 1000000).toString();
};

const isHashMatch = (actual: string, expected: string) => {
  const actualBuffer = Buffer.from(actual, 'hex');
  const expectedBuffer = Buffer.from(expected, 'hex');
  return actualBuffer.length === expectedBuffer.length && crypto.timingSafeEqual(actualBuffer, expectedBuffer);
};

const createLoginOtp = async (userId: string, email: string): Promise<LoginOtpChallenge> => {
  const challengeId = crypto.randomUUID();
  const code = createCode();
  const expiresAt = new Date(Date.now() + config.otp.expiresMinutes * 60 * 1000);

  await prisma.loginOtp.deleteMany({
    where: {
      userId,
      consumedAt: null,
    },
  });

  const challenge = await prisma.loginOtp.create({
    data: {
      id: challengeId,
      userId,
      codeHash: hashOtp(challengeId, code),
      expiresAt,
    },
  });

  try {
    await emailService.sendLoginOtpEmail(email, code, config.otp.expiresMinutes);
  } catch (error) {
    await prisma.loginOtp.delete({ where: { id: challenge.id } });
    throw error;
  }

  return {
    id: challenge.id,
    email,
    expiresAt: challenge.expiresAt,
  };
};

const verifyLoginOtp = async (challengeId: string, code: string): Promise<PublicUser> => {
  // Reserve an attempt in one conditional UPDATE so concurrent guesses cannot exceed maxAttempts.
  const reserved = await prisma.loginOtp.updateMany({
    where: {
      id: challengeId,
      consumedAt: null,
      expiresAt: { gt: new Date() },
      attempts: { lt: config.otp.maxAttempts },
    },
    data: { attempts: { increment: 1 } },
  });

  if (reserved.count !== 1) {
    const exhausted = await prisma.loginOtp.findFirst({
      where: {
        id: challengeId,
        consumedAt: null,
        expiresAt: { gt: new Date() },
        attempts: { gte: config.otp.maxAttempts },
      },
      select: { id: true },
    });
    throw new ApiError(httpStatus.UNAUTHORIZED, exhausted ? 'Too many attempts' : 'Invalid or expired code');
  }

  const challenge = await prisma.loginOtp.findUnique({
    where: { id: challengeId },
    include: {
      user: {
        select: { ...publicUserSelect, isActive: true },
      },
    },
  });

  if (!challenge || !isHashMatch(hashOtp(challenge.id, code.trim()), challenge.codeHash)) {
    throw new ApiError(httpStatus.UNAUTHORIZED, 'Invalid or expired code');
  }

  const consumeResult = await prisma.loginOtp.updateMany({
    where: {
      id: challenge.id,
      consumedAt: null,
    },
    data: {
      consumedAt: new Date(),
    },
  });

  if (consumeResult.count !== 1) {
    throw new ApiError(httpStatus.UNAUTHORIZED, 'Invalid or expired code');
  }

  const { isActive, ...user } = challenge.user;
  if (!isActive) {
    throw new ApiError(httpStatus.FORBIDDEN, 'Account is disabled');
  }

  return user;
};

export { createLoginOtp, hashOtp, verifyLoginOtp };
