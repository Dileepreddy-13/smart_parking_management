import jwt, { type SignOptions } from 'jsonwebtoken';
import { env } from '../config/env';

export interface TokenPayload {
  sub: string;
  role: 'USER' | 'ADMIN';
}

export const signToken = (payload: TokenPayload) =>
  jwt.sign(payload, env.JWT_SECRET, { expiresIn: env.JWT_EXPIRES_IN as SignOptions['expiresIn'] });

export const verifyToken = (token: string) => jwt.verify(token, env.JWT_SECRET) as TokenPayload & { exp: number };
