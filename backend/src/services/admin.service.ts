import { and, count, desc, eq, gte, ilike, inArray, or, sql } from 'drizzle-orm';
import type { z } from 'zod';
import { env } from '../config/env';
import { db } from '../db';
import { parkingAreas, parkingSlots, payments, reservations, users } from '../db/schema';
import { emitAdminActivity } from '../sockets';
import { badRequest, notFound } from '../utils/errors';
import { startOfLocalDay } from '../utils/time';
import type { adminUserQuery } from '../validators';
import { occupancy } from './parking.service';

const tz = () => sql.raw(`'${env.APP_TIMEZONE.replace(/[^A-Za-z0-9_/+-]/g, '')}'`);
/** Money actually kept: successful payments, minus anything refunded. */
const netRevenue = sql<string>`coalesce(sum(${payments.amount} - coalesce(${payments.refundAmount}, 0)), 0)`;
const paid = inArray(payments.status, ['SUCCESS', 'REFUNDED']);

/** One row per calendar day (app timezone) for the last `days` days, zero-filled. */
async function dailySeries(days: number) {
  const result = await db.execute<{ day: string; revenue: string; reservations: string }>(sql`
    WITH days AS (
      SELECT generate_series((now() AT TIME ZONE ${tz()})::date - ${days - 1}::int, (now() AT TIME ZONE ${tz()})::date, interval '1 day')::date AS day
    )
    SELECT to_char(d.day, 'YYYY-MM-DD') AS day,
           (SELECT coalesce(sum(p.amount - coalesce(p.refund_amount, 0)), 0) FROM ${payments} p
             WHERE p.status IN ('SUCCESS', 'REFUNDED') AND (p.paid_at AT TIME ZONE ${tz()})::date = d.day) AS revenue,
           (SELECT count(*) FROM ${reservations} r
             WHERE r.status NOT IN ('PENDING', 'EXPIRED') AND (r.created_at AT TIME ZONE ${tz()})::date = d.day) AS reservations
    FROM days d ORDER BY d.day`);
  return result.rows.map((r) => ({ day: r.day, revenue: Number(r.revenue), reservations: Number(r.reservations) }));
}

export async function dashboard() {
  const today = startOfLocalDay();
  const [occ, [userStats], [todayRes], [todayRev], [active], series, [totalRev]] = await Promise.all([
    occupancy(),
    db.select({ total: count() }).from(users).where(eq(users.role, 'USER')),
    db
      .select({ n: count() })
      .from(reservations)
      .where(and(gte(reservations.createdAt, today), sql`${reservations.status} NOT IN ('PENDING', 'EXPIRED')`)),
    db.select({ revenue: netRevenue }).from(payments).where(and(paid, gte(payments.paidAt, today))),
    db
      .select({ n: count() })
      .from(reservations)
      .where(inArray(reservations.status, ['CONFIRMED', 'ACTIVE'])),
    dailySeries(14),
    db.select({ revenue: netRevenue }).from(payments).where(paid),
  ]);

  return {
    stats: {
      totalParkingAreas: occ.areas.filter((a) => a.status === 'ACTIVE').length,
      totalSlots: occ.totals.total,
      availableSlots: occ.totals.AVAILABLE,
      occupiedSlots: occ.totals.OCCUPIED,
      reservedSlots: occ.totals.RESERVED,
      maintenanceSlots: occ.totals.MAINTENANCE,
      occupancyPercent: occ.totals.occupancyPercent,
      todaysReservations: todayRes.n,
      todaysRevenue: Number(todayRev.revenue),
      totalRevenue: Number(totalRev.revenue),
      activeReservations: active.n,
      totalUsers: userStats.total,
    },
    charts: {
      occupancyByArea: occ.areas.map((a) => ({
        name: a.name,
        available: a.available,
        reserved: a.reserved,
        occupied: a.occupied,
        maintenance: a.maintenance,
        occupancyPercent: a.occupancyPercent,
      })),
      overTime: series,
      slotStatus: [
        { status: 'AVAILABLE', count: occ.totals.AVAILABLE },
        { status: 'RESERVED', count: occ.totals.RESERVED },
        { status: 'OCCUPIED', count: occ.totals.OCCUPIED },
        { status: 'MAINTENANCE', count: occ.totals.MAINTENANCE },
      ],
    },
  };
}

/** Revenue report: totals, per day, per parking area, per vehicle type and busiest start hours. */
export async function revenue(days: number) {
  const since = new Date(startOfLocalDay().getTime() - (days - 1) * 86_400_000);
  const inRange = and(paid, gte(payments.paidAt, since));
  const [series, [totals], byArea, byVehicle, statusRows, peak] = await Promise.all([
    dailySeries(days),
    db
      .select({
        gross: sql<string>`coalesce(sum(${payments.amount}), 0)`,
        refunds: sql<string>`coalesce(sum(${payments.refundAmount}), 0)`,
        net: netRevenue,
        payments: count(),
      })
      .from(payments)
      .where(inRange),
    db
      .select({ name: parkingAreas.name, revenue: netRevenue, bookings: count() })
      .from(payments)
      .innerJoin(reservations, eq(reservations.id, payments.reservationId))
      .innerJoin(parkingSlots, eq(parkingSlots.id, reservations.parkingSlotId))
      .innerJoin(parkingAreas, eq(parkingAreas.id, parkingSlots.parkingAreaId))
      .where(inRange)
      .groupBy(parkingAreas.name)
      .orderBy(desc(netRevenue)),
    db
      .select({ vehicleType: parkingSlots.vehicleType, revenue: netRevenue, bookings: count() })
      .from(payments)
      .innerJoin(reservations, eq(reservations.id, payments.reservationId))
      .innerJoin(parkingSlots, eq(parkingSlots.id, reservations.parkingSlotId))
      .where(inRange)
      .groupBy(parkingSlots.vehicleType),
    db.select({ status: reservations.status, n: count() }).from(reservations).where(gte(reservations.createdAt, since)).groupBy(reservations.status),
    db.execute<{ hour: number; n: string }>(sql`
      SELECT extract(hour FROM r.start_time AT TIME ZONE ${tz()})::int AS hour, count(*) AS n
      FROM ${reservations} r
      WHERE r.created_at >= ${since} AND r.status NOT IN ('PENDING', 'EXPIRED')
      GROUP BY 1 ORDER BY 1`),
  ]);

  return {
    days,
    from: since,
    totals: { gross: Number(totals.gross), refunds: Number(totals.refunds), net: Number(totals.net), payments: totals.payments },
    overTime: series,
    byArea: byArea.map((r) => ({ name: r.name, revenue: Number(r.revenue), bookings: r.bookings })),
    byVehicleType: byVehicle.map((r) => ({ vehicleType: r.vehicleType, revenue: Number(r.revenue), bookings: r.bookings })),
    reservationsByStatus: statusRows.map((r) => ({ status: r.status, count: r.n })),
    peakHours: Array.from({ length: 24 }, (_, hour) => ({ hour, bookings: Number(peak.rows.find((p) => p.hour === hour)?.n ?? 0) })),
  };
}

const userColumns = {
  id: users.id,
  name: users.name,
  email: users.email,
  phone: users.phone,
  role: users.role,
  status: users.status,
  createdAt: users.createdAt,
};

/** Password hashes are never selected here, so they cannot reach an admin screen. */
export async function listUsers(query: z.infer<typeof adminUserQuery>) {
  const term = query.q ? `%${query.q.replace(/[%_]/g, '\\$&')}%` : null;
  const where = term ? or(ilike(users.name, term), ilike(users.email, term), ilike(users.phone, term)) : undefined;
  const [items, [{ total }]] = await Promise.all([
    db
      .select({ ...userColumns, bookings: sql<number>`(SELECT count(*)::int FROM ${reservations} r WHERE r.user_id = "users"."id")` })
      .from(users)
      .where(where)
      .orderBy(desc(users.createdAt))
      .limit(query.pageSize)
      .offset((query.page - 1) * query.pageSize),
    db.select({ total: count() }).from(users).where(where),
  ]);
  return { items, total, page: query.page, pageSize: query.pageSize };
}

export async function getUser(id: string) {
  const [user] = await db.select(userColumns).from(users).where(eq(users.id, id));
  if (!user) throw notFound('User');
  const [vehicleRows, [stats]] = await Promise.all([
    db.query.vehicles.findMany({ where: (v, { eq: is }) => is(v.userId, id) }),
    db
      .select({
        bookings: count(),
        spent: sql<string>`coalesce((SELECT sum(p.amount - coalesce(p.refund_amount, 0)) FROM ${payments} p WHERE p.user_id = ${id} AND p.status IN ('SUCCESS', 'REFUNDED')), 0)`,
      })
      .from(reservations)
      .where(eq(reservations.userId, id)),
  ]);
  return { ...user, vehicles: vehicleRows, bookings: stats.bookings, totalSpent: Number(stats.spent) };
}

export async function setUserStatus(id: string, status: 'ACTIVE' | 'INACTIVE', actorId: string) {
  if (id === actorId) throw badRequest('You cannot deactivate your own account.');
  const [user] = await db.update(users).set({ status }).where(eq(users.id, id)).returning(userColumns);
  if (!user) throw notFound('User');
  emitAdminActivity('user');
  return user;
}
