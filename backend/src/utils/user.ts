import type { User } from '../generated/prisma/client.js';

type PublicUser = Pick<User, 'id' | 'name' | 'email' | 'role' | 'isEmailVerified'>;

const publicUserSelect = {
  id: true,
  name: true,
  email: true,
  role: true,
  isEmailVerified: true,
};

const toPublicUser = (user: User): PublicUser => {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    isEmailVerified: user.isEmailVerified,
  };
};

export { publicUserSelect, toPublicUser };
export type { PublicUser };
