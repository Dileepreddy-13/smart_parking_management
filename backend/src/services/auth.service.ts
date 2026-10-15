import bcrypt from 'bcryptjs';
import { eq } from 'drizzle-orm';
import type { z } from 'zod';
import { db } from '../db';
import { users, type User } from '../db/schema';
import { AppError, conflict, unauthorized } from '../utils/errors';
import { signToken } from '../utils/jwt';
import type { loginSchema, passwordSchema, profileSchema, registerSchema } from '../validators';
import { sendEmail } from './email.service';
import { notify } from './notification.service';

const SALT_ROUNDS = 10;

export const publicUser = ({ passwordHash: _omit, ...rest }: User) => rest;
const session = (user: User) => ({
  token: signToken({ sub: user.id, role: user.role }),
  user: publicUser(user),
});

export const hashPassword = (plain: string) => bcrypt.hash(plain, SALT_ROUNDS);

export async function register(input: z.infer<typeof registerSchema>) {
  const existing = await db.query.users.findFirst({ where: eq(users.email, input.email), columns: { id: true } });
  if (existing) throw conflict('An account with this email already exists.', 'EMAIL_TAKEN');

  const [user] = await db
    .insert(users)
    .values({ name: input.name, email: input.email, phone: input.phone, passwordHash: await hashPassword(input.password) })
    .returning();

  await notify({
    userId: user.id,
    type: 'SYSTEM',
    title: 'Welcome to Smart Parking',
    message: `Hi ${user.name}, your account is ready. Find a parking area, pick a slot and reserve it in under a minute.`,
    email: false,
  });
  void sendEmail(user.email, 'Welcome to Smart Parking', `Hi ${user.name}, your Smart Parking account has been created.`);
  return session(user);
}

export async function login(input: z.infer<typeof loginSchema>) {
  const user = await db.query.users.findFirst({ where: eq(users.email, input.email) });
  // Same message for "no such user" and "wrong password" so accounts cannot be enumerated.
  if (!user || !(await bcrypt.compare(input.password, user.passwordHash)))
    throw unauthorized('Incorrect email or password.', 'INVALID_CREDENTIALS');
  if (user.status !== 'ACTIVE')
    throw new AppError(403, 'ACCOUNT_INACTIVE', 'This account has been deactivated. Contact the parking administrator.');
  return session(user);
}

export async function updateProfile(userId: string, input: z.infer<typeof profileSchema>) {
  const [user] = await db
    .update(users)
    .set({ name: input.name, phone: input.phone ?? null })
    .where(eq(users.id, userId))
    .returning();
  return publicUser(user);
}

export async function changePassword(userId: string, input: z.infer<typeof passwordSchema>) {
  const user = await db.query.users.findFirst({ where: eq(users.id, userId) });
  if (!user || !(await bcrypt.compare(input.currentPassword, user.passwordHash)))
    throw new AppError(400, 'INVALID_CREDENTIALS', 'Current password is incorrect.');
  await db
    .update(users)
    .set({ passwordHash: await hashPassword(input.newPassword) })
    .where(eq(users.id, userId));
}
