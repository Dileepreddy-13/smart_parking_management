import rateLimit from 'express-rate-limit';
import { env } from '../config/env';

const skip = () => env.NODE_ENV !== 'production';
const message = (text: string) => ({ error: { code: 'RATE_LIMITED', message: text } });

/** Limits are enforced in production only so local demos and automated tests are never throttled. */
export const authLimiter = rateLimit({
  windowMs: 15 * 60_000,
  limit: 30,
  skip,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: message('Too many attempts. Please wait a few minutes and try again.'),
});

export const apiLimiter = rateLimit({
  windowMs: 60_000,
  limit: 300,
  skip,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: message('Too many requests. Please slow down.'),
});
