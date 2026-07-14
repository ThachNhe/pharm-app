import bcrypt from 'bcryptjs';
import httpStatus from 'http-status';
import type { Prisma, Role, User } from '../generated/prisma/client.js';
import { prisma } from '../config/database.js';
import ApiError from '../utils/ApiError.js';
import { publicUserSelect, toPublicUser, type PublicUser } from '../utils/user.js';

type CreateUserBody = {
  name: string;
  email: string;
  password: string;
  role?: Role;
  isEmailVerified?: boolean;
};

type UpdateUserBody = Partial<CreateUserBody>;

const isEmailTaken = async (email: string, excludeUserId?: string) => {
  const user = await prisma.user.findFirst({
    where: {
      email,
      ...(excludeUserId ? { id: { not: excludeUserId } } : {}),
    },
  });
  return !!user;
};

/**
 * Create a user
 * @param {Object} userBody
 * @returns {Promise<User>}
 */
const createUser = async (userBody: CreateUserBody): Promise<PublicUser> => {
  if (await isEmailTaken(userBody.email)) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Email already taken');
  }
  const user = await prisma.user.create({
    data: {
      ...userBody,
      password: await bcrypt.hash(userBody.password, 8),
    },
  });
  return toPublicUser(user);
};

/**
 * Query for users
 * @param {Object} filter - Prisma filter input
 * @param {Object} options - Query options
 * @param {string} [options.sortBy] - Sort option in the format: sortField:(desc|asc)
 * @param {number} [options.limit] - Maximum number of results per page (default = 10)
 * @param {number} [options.page] - Current page (default = 1)
 * @returns {Promise<QueryResult>}
 */
const queryUsers = async (filter, options) => {
  const limit = options.limit && parseInt(options.limit, 10) > 0 ? parseInt(options.limit, 10) : 10;
  const page = options.page && parseInt(options.page, 10) > 0 ? parseInt(options.page, 10) : 1;
  const skip = (page - 1) * limit;

  let orderBy: Prisma.UserOrderByWithRelationInput[] = [{ createdAt: 'asc' }];
  if (options.sortBy) {
    const sortingCriteria = [];
    options.sortBy.split(',').forEach((sortOption) => {
      const [key, direction] = sortOption.split(':');
      if (['name', 'email', 'role', 'createdAt'].includes(key)) {
        sortingCriteria.push({ [key]: direction === 'desc' ? 'desc' : 'asc' });
      }
    });
    if (sortingCriteria.length) {
      orderBy = sortingCriteria;
    }
  }

  const where: Prisma.UserWhereInput = {};
  if (filter.name) {
    where.name = { contains: filter.name, mode: 'insensitive' };
  }
  if (filter.role) {
    where.role = filter.role;
  }

  const [count, rows] = await prisma.$transaction([
    prisma.user.count({ where }),
    prisma.user.findMany({
      where,
      orderBy,
      take: limit,
      skip,
      select: publicUserSelect,
    }),
  ]);

  const totalPages = Math.ceil(count / limit);

  return {
    results: rows,
    page,
    limit,
    totalPages,
    totalResults: count,
  };
};

/**
 * Get user by id
 * @param {string} id
 * @returns {Promise<User>}
 */
const getUserById = async (id: string): Promise<PublicUser | null> => {
  return prisma.user.findUnique({
    where: { id },
    select: publicUserSelect,
  });
};

/**
 * Get user by email
 * @param {string} email
 * @returns {Promise<User>}
 */
const getUserByEmail = async (email: string): Promise<User | null> => {
  return prisma.user.findUnique({ where: { email } });
};

/**
 * Update user by id
 * @param {string} userId
 * @param {Object} updateBody
 * @returns {Promise<User>}
 */
const updateUserById = async (userId: string, updateBody: UpdateUserBody): Promise<PublicUser> => {
  const user = await getUserById(userId);
  if (!user) {
    throw new ApiError(httpStatus.NOT_FOUND, 'User not found');
  }
  if (updateBody.email && (await isEmailTaken(updateBody.email, userId))) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Email already taken');
  }

  const data = {
    ...updateBody,
    ...(updateBody.password ? { password: await bcrypt.hash(updateBody.password, 8) } : {}),
  };

  const updatedUser = await prisma.user.update({
    where: { id: userId },
    data,
  });

  return toPublicUser(updatedUser);
};

/**
 * Delete user by id
 * @param {string} userId
 * @returns {Promise<User>}
 */
const deleteUserById = async (userId: string): Promise<PublicUser> => {
  const user = await getUserById(userId);
  if (!user) {
    throw new ApiError(httpStatus.NOT_FOUND, 'User not found');
  }
  await prisma.user.delete({ where: { id: userId } });
  return user;
};

export { createUser, queryUsers, getUserById, getUserByEmail, updateUserById, deleteUserById };
