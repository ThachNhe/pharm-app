import type { PublicUser } from '../utils/user.js';

declare global {
  namespace Express {
    interface User extends PublicUser {}
  }
}

export {};
