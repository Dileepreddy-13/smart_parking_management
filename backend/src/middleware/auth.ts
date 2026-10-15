import type { RequestHandler } from 'express';
import { eq } from 'drizzle-orm';
import jwt from 'jsonwebtoken';
import { db } from '../db';
import { users } from '../db/schema';
import { AppError, forbidden, unauthorized } from '../utils/errors';
import { verifyToken } from '../utils/jwt';

async function loadUser(header: string | undefined) {
  if (!header?.startsWith('Bearer ')) return null;
  let payload;
  try {
    payload = verifyToken(header.slice(7));
  } catch (err) {
    if (err instanceof jwt.TokenExpiredError)
      throw new AppError(401, 'TOKEN_EXPIRED', 'Your session has expired. Please log in again.');
    throw unauthorized('Invalid session. Please log in again.', 'TOKEN_INVALID');
  }
  const user = await db.query.users.findFirst({ where: eq(users.id, payload.sub), columns: { passwordHash: false } });
  if (!user) throw unauthorized('Invalid session. Please log in again.', 'TOKEN_INVALID');
  if (user.status !== 'ACTIVE') throw new AppError(403, 'ACCOUNT_INACTIVE', 'This account has been deactivated.');
  return user;
}

/** Requires a valid JWT. The user is re-read on every request so deactivation takes effect immediately. */
export const authenticate: RequestHandler = (req, _res, next) => {
  loadUser(req.headers.authorization)
    .then((user) => {
      if (!user) throw unauthorized();
      req.user = user;
      next();
    })
    .catch(next);
};

/** Attaches the user when a valid token is sent, but lets anonymous visitors through. */
export const optionalAuth: RequestHandler = (req, _res, next) => {
  loadUser(req.headers.authorization)
    .then((user) => {
      if (user) req.user = user;
      next();
    })
    .catch(() => next());
};

export const requireRole =
  (...roles: Array<'USER' | 'ADMIN'>): RequestHandler =>
  (req, _res, next) => {
    if (!req.user) return next(unauthorized());
    if (!roles.includes(req.user.role)) return next(forbidden());
    next();
  };

export const requireAdmin = [authenticate, requireRole('ADMIN')];
