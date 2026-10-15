import type { User } from '../db/schema';

declare global {
  namespace Express {
    interface Request {
      /** Set by the `authenticate` middleware. Never contains the password hash. */
      user?: Omit<User, 'passwordHash'>;
    }
  }
}
export {};
