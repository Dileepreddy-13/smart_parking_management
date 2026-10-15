import { and, count, desc, eq } from 'drizzle-orm';
import { db } from '../db';
import { notifications, users } from '../db/schema';
import { emitToUser } from '../sockets';
import { notFound } from '../utils/errors';
import { sendEmail } from './email.service';

type NotificationType = (typeof notifications.$inferInsert)['type'];

interface NotifyInput {
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  reservationId?: string;
  /** Also send the same content by e-mail (default true). */
  email?: boolean;
}

/** Persists an in-app notification, pushes it over Socket.IO and (optionally) e-mails it. */
export async function notify(input: NotifyInput) {
  const [row] = await db
    .insert(notifications)
    .values({
      userId: input.userId,
      type: input.type,
      title: input.title,
      message: input.message,
      reservationId: input.reservationId,
    })
    .returning();
  emitToUser(input.userId, 'notification:new', row);

  if (input.email !== false) {
    const user = await db.query.users.findFirst({ where: eq(users.id, input.userId), columns: { email: true } });
    if (user) void sendEmail(user.email, input.title, input.message);
  }
  return row;
}

export async function listNotifications(userId: string, limit = 50) {
  const [items, [{ unread }]] = await Promise.all([
    db.query.notifications.findMany({
      where: eq(notifications.userId, userId),
      orderBy: desc(notifications.createdAt),
      limit,
    }),
    db
      .select({ unread: count() })
      .from(notifications)
      .where(and(eq(notifications.userId, userId), eq(notifications.isRead, false))),
  ]);
  return { items, unread };
}

export async function markRead(userId: string, id: string) {
  const [row] = await db
    .update(notifications)
    .set({ isRead: true })
    .where(and(eq(notifications.id, id), eq(notifications.userId, userId)))
    .returning();
  if (!row) throw notFound('Notification');
  return row;
}

export async function markAllRead(userId: string) {
  const rows = await db
    .update(notifications)
    .set({ isRead: true })
    .where(and(eq(notifications.userId, userId), eq(notifications.isRead, false)))
    .returning({ id: notifications.id });
  return { updated: rows.length };
}

/** Admin: send a SYSTEM notification to one user or to every active customer. */
export async function broadcast(title: string, message: string, userId?: string) {
  const targets = userId
    ? await db.select({ id: users.id }).from(users).where(eq(users.id, userId))
    : await db
        .select({ id: users.id })
        .from(users)
        .where(and(eq(users.role, 'USER'), eq(users.status, 'ACTIVE')));
  if (userId && targets.length === 0) throw notFound('User');
  await Promise.all(targets.map((t) => notify({ userId: t.id, type: 'SYSTEM', title, message, email: false })));
  return { sent: targets.length };
}

/** Admin: the most recent notifications across all users. */
export async function recentNotifications(limit = 100) {
  return db.query.notifications.findMany({
    orderBy: desc(notifications.createdAt),
    limit,
    with: { user: { columns: { id: true, name: true, email: true } } },
  });
}
