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
  const challenge = await prisma.loginOtp.findUnique({
    where: { id: challengeId },
    include: {
      user: {
        select: publicUserSelect,
      },
    },
  });

  if (!challenge || challenge.consumedAt || challenge.expiresAt < new Date()) {
    throw new ApiError(httpStatus.UNAUTHORIZED, 'Invalid or expired code');
  }

  if (challenge.attempts >= config.otp.maxAttempts) {
    throw new ApiError(httpStatus.UNAUTHORIZED, 'Too many attempts');
  }

  const codeHash = hashOtp(challenge.id, code.trim());

  if (!isHashMatch(codeHash, challenge.codeHash)) {
    await prisma.loginOtp.update({
      where: { id: challenge.id },
      data: { attempts: { increment: 1 } },
    });

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

  return challenge.user;
};

export { createLoginOtp, hashOtp, verifyLoginOtp };
