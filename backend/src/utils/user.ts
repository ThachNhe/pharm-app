import type { User } from '../generated/prisma/client.js';

type PublicUser = Pick<User, 'id' | 'name' | 'email' | 'role'>;
type AuthenticatedUser = PublicUser & Pick<User, 'isSystemAdmin' | 'isActive'>;

const publicUserSelect = {
  id: true,
  name: true,
  email: true,
  role: true,
};

const authenticatedUserSelect = {
  ...publicUserSelect,
  isSystemAdmin: true,
  isActive: true,
};

const toPublicUser = (user: User): PublicUser => {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
  };
};

export { authenticatedUserSelect, publicUserSelect, toPublicUser };
export type { AuthenticatedUser, PublicUser };
