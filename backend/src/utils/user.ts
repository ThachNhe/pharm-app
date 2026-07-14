import type { User } from '../generated/prisma/client.js';

type PublicUser = Omit<User, 'password' | 'createdAt' | 'updatedAt'>;

const publicUserSelect = {
  id: true,
  name: true,
  email: true,
  role: true,
  isEmailVerified: true,
};

const toPublicUser = (user: User): PublicUser => {
  const { password, createdAt, updatedAt, ...publicUser } = user;
  return publicUser;
};

export { publicUserSelect, toPublicUser };
export type { PublicUser };
