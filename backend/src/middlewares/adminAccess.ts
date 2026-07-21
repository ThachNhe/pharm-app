import httpStatus from 'http-status';
import type { NextFunction, Request, Response } from 'express';
import { prisma } from '../config/database.js';
import ApiError from '../utils/ApiError.js';

const requireAdminPanelAccess = async (req: Request, res: Response, next: NextFunction) => {
  if (!req.user || !req.user.isActive) {
    return next(new ApiError(httpStatus.FORBIDDEN, 'Forbidden'));
  }

  if (req.user.isSystemAdmin) {
    return next();
  }

  const adminRoleCount = await prisma.userStoreRole.count({
    where: {
      userId: req.user.id,
      role: { in: ['owner', 'manager'] },
      store: { isActive: true },
    },
  });

  if (!adminRoleCount) {
    return next(new ApiError(httpStatus.FORBIDDEN, 'Staff cannot access admin panel'));
  }

  return next();
};

export default requireAdminPanelAccess;
