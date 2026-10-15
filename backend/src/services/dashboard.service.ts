import { and, asc, count, desc, eq, inArray, sql } from 'drizzle-orm';
import { db } from '../db';
import { payments, reservations } from '../db/schema';
import { listNotifications } from './notification.service';
import { listForUser as listPayments } from './payment.service';
import { toReservationDto } from './reservation.service';

const details = {
  slot: { with: { area: { columns: { id: true, name: true, address: true, city: true, latitude: true, longitude: true } } } },
  payment: true,
  user: { columns: { id: true, name: true, email: true, phone: true } },
} as const;

/** Everything the customer dashboard shows, in one request. */
export async function userDashboard(userId: string) {
  const mine = eq(reservations.userId, userId);
  const [active, upcoming, statusRows, [spent], recentPayments, notifications, monthly] = await Promise.all([
    db.query.reservations.findFirst({ where: and(mine, eq(reservations.status, 'ACTIVE')), with: details, orderBy: asc(reservations.endTime) }),
    db.query.reservations.findFirst({ where: and(mine, eq(reservations.status, 'CONFIRMED')), with: details, orderBy: asc(reservations.startTime) }),
    db.select({ status: reservations.status, n: count() }).from(reservations).where(mine).groupBy(reservations.status),
    db
      .select({ total: sql<string>`coalesce(sum(${payments.amount} - coalesce(${payments.refundAmount}, 0)), 0)` })
      .from(payments)
      .where(and(eq(payments.userId, userId), inArray(payments.status, ['SUCCESS', 'REFUNDED']))),
    listPayments(userId, 5),
    listNotifications(userId, 5),
    db
      .select({
        month: sql<string>`to_char(date_trunc('month', ${reservations.startTime}), 'YYYY-MM')`,
        bookings: count(),
      })
      .from(reservations)
      .where(and(mine, inArray(reservations.status, ['CONFIRMED', 'ACTIVE', 'COMPLETED']), sql`${reservations.startTime} > now() - interval '6 months'`))
      .groupBy(sql`1`)
      .orderBy(desc(sql`1`)),
  ]);

  const by = Object.fromEntries(statusRows.map((r) => [r.status, r.n])) as Record<string, number>;
  return {
    activeReservation: active ? toReservationDto(active) : null,
    upcomingReservation: upcoming ? toReservationDto(upcoming) : null,
    stats: {
      totalBookings: statusRows.reduce((sum, r) => sum + (r.status === 'EXPIRED' || r.status === 'PENDING' ? 0 : r.n), 0),
      completedBookings: by.COMPLETED ?? 0,
      cancelledBookings: by.CANCELLED ?? 0,
      upcomingBookings: by.CONFIRMED ?? 0,
      totalSpent: Number(spent.total),
    },
    recentPayments: recentPayments.items,
    notifications,
    bookingsByMonth: monthly.reverse(),
  };
}
