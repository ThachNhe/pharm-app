import type { AuthenticatedUser } from '../utils/user.js';

declare global {
  namespace Express {
    interface User extends AuthenticatedUser {}
  }
}

export {};
