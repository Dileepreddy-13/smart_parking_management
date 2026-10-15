import { randomInt } from 'node:crypto';
import { and, count, desc, eq, ilike, inArray, or, sql, type SQL } from 'drizzle-orm';
import type { z } from 'zod';
import { env } from '../config/env';
import { db, type DbOrTx } from '../db';
import { parkingAreas, parkingRates, parkingSlots, payments, reservations, users, vehicles, type ReservationStatus } from '../db/schema';
import { emitAdminActivity, emitSlotsChanged } from '../sockets';
import { badRequest, conflict, forbidden, notFound } from '../utils/errors';
import { calculatePrice, refundPolicy, roundMoney } from '../utils/pricing';
import { formatDateTime } from '../utils/time';
import type { adminReservationQuery, reservationQuery, reservationSchema } from '../validators';
import {
  assertWithinOperatingHours,
  blockingReservation,
  overlaps,
  RESERVED_LEAD_MINUTES,
  syncSlotStatuses,
  vehicleFitsSlot,
} from './availability';
import { notify } from './notification.service';
import { refundOnGateway } from './payment.gateway';

type BookingInput = z.infer<typeof reservationSchema>;

export const MIN_BOOKING_MINUTES = 30;
export const MAX_BOOKING_HOURS = 24;
export const MAX_ADVANCE_DAYS = 30;
const policy = () => ({ freeCancelMinutes: env.FREE_CANCEL_MINUTES, lateRefundPercent: env.LATE_CANCEL_REFUND_PERCENT });

const details = {
  slot: { with: { area: { columns: { id: true, name: true, address: true, city: true, latitude: true, longitude: true } } } },
  payment: true,
  user: { columns: { id: true, name: true, email: true, phone: true } },
} as const;

type ReservationRow = NonNullable<Awaited<ReturnType<typeof findById>>>;
const findById = (dbx: DbOrTx, id: string) => dbx.query.reservations.findFirst({ where: eq(reservations.id, id), with: details });

export function toReservationDto(r: ReservationRow) {
  const decision = refundPolicy(r.startTime, new Date(), policy());
  const cancellable = r.status === 'PENDING' || (r.status === 'CONFIRMED' && decision.allowed);
  return {
    id: r.id,
    bookingRef: r.bookingRef,
    status: r.status,
    startTime: r.startTime,
    endTime: r.endTime,
    billedHours: Number(r.billedHours),
    hourlyRate: Number(r.hourlyRate),
    baseAmount: Number(r.baseAmount),
    taxAmount: Number(r.taxAmount),
    amount: Number(r.amount),
    vehicleNumber: r.vehicleNumber,
    cancelledAt: r.cancelledAt,
    cancelReason: r.cancelReason,
    createdAt: r.createdAt,
    /** Unpaid holds lapse at this time. */
    payBy: r.status === 'PENDING' ? new Date(r.createdAt.getTime() + env.PAYMENT_HOLD_MINUTES * 60_000) : null,
    slot: { id: r.slot.id, slotNumber: r.slot.slotNumber, floor: r.slot.floor, vehicleType: r.slot.vehicleType, isEv: r.slot.isEv },
    area: r.slot.area,
    user: r.user,
    payment: r.payment
      ? {
          id: r.payment.id,
          status: r.payment.status,
          amount: Number(r.payment.amount),
          currency: r.payment.currency,
          provider: r.payment.provider,
          razorpayOrderId: r.payment.razorpayOrderId,
          razorpayPaymentId: r.payment.razorpayPaymentId,
          refundAmount: r.payment.refundAmount === null ? null : Number(r.payment.refundAmount),
          paidAt: r.payment.paidAt,
        }
      : null,
    cancellation: {
      allowed: cancellable,
      refundPercent: r.status === 'CONFIRMED' && decision.allowed ? decision.refundPercent : 0,
      note: r.status === 'PENDING' ? 'Unpaid booking: nothing to refund.' : decision.reason,
    },
  };
}
export type ReservationDto = ReturnType<typeof toReservationDto>;

function validateWindow(start: Date, end: Date) {
  const now = Date.now();
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) throw badRequest('Invalid date or time.', 'INVALID_TIME_RANGE');
  if (end <= start) throw badRequest('End time must be after start time.', 'INVALID_TIME_RANGE');
  if (start.getTime() < now - 2 * 60_000) throw badRequest('Start time cannot be in the past.', 'INVALID_TIME_RANGE');
  const minutes = (end.getTime() - start.getTime()) / 60_000;
  if (minutes < MIN_BOOKING_MINUTES) throw badRequest(`Minimum booking is ${MIN_BOOKING_MINUTES} minutes.`, 'INVALID_TIME_RANGE');
  if (minutes > MAX_BOOKING_HOURS * 60) throw badRequest(`Maximum booking is ${MAX_BOOKING_HOURS} hours.`, 'INVALID_TIME_RANGE');
  if (start.getTime() > now + MAX_ADVANCE_DAYS * 86_400_000)
    throw badRequest(`Bookings can be made up to ${MAX_ADVANCE_DAYS} days in advance.`, 'INVALID_TIME_RANGE');
}

/**
 * Every server-side check a booking must pass, in the order required by the case study:
 * slot exists → not under maintenance → time valid → area open → no overlap → price.
 * Used both for the price preview (quote) and inside the booking transaction.
 */
async function validateBooking(dbx: DbOrTx, userId: string, input: BookingInput) {
  const slot = await dbx.query.parkingSlots.findFirst({
    where: eq(parkingSlots.id, input.slotId),
    with: { area: { with: { operatingHours: true } } },
  });
  if (!slot) throw notFound('Parking slot');
  if (slot.status === 'MAINTENANCE') throw conflict('This slot is under maintenance.', 'SLOT_UNAVAILABLE');

  validateWindow(input.startTime, input.endTime);
  assertWithinOperatingHours(slot.area, slot.area.operatingHours, input.startTime, input.endTime);

  if (slot.status === 'OCCUPIED' && input.startTime.getTime() <= Date.now() + RESERVED_LEAD_MINUTES * 60_000)
    throw conflict('This slot is occupied right now. Choose another slot or a later time.', 'SLOT_UNAVAILABLE');

  const [clash] = await dbx
    .select({ id: reservations.id })
    .from(reservations)
    .where(and(eq(reservations.parkingSlotId, slot.id), blockingReservation(), overlaps(input.startTime, input.endTime)))
    .limit(1);
  if (clash) throw conflict('This slot is already reserved for the selected time. Please pick another slot or time.', 'SLOT_ALREADY_RESERVED');

  let vehicle: typeof vehicles.$inferSelect | undefined;
  if (input.vehicleId) {
    vehicle = await dbx.query.vehicles.findFirst({ where: and(eq(vehicles.id, input.vehicleId), eq(vehicles.userId, userId)) });
    if (!vehicle) throw notFound('Vehicle');
    if (!vehicleFitsSlot(vehicle.vehicleType, slot.vehicleType))
      throw badRequest(`A ${vehicle.vehicleType} cannot be parked in a ${slot.vehicleType} slot.`, 'VEHICLE_MISMATCH');
  }

  let hourlyRate = slot.price === null ? null : Number(slot.price);
  if (hourlyRate === null) {
    const rate = await dbx.query.parkingRates.findFirst({
      where: and(eq(parkingRates.parkingAreaId, slot.parkingAreaId), eq(parkingRates.vehicleType, slot.vehicleType)),
    });
    if (!rate) throw badRequest('No parking rate is configured for this slot yet.', 'PARKING_UNAVAILABLE');
    hourlyRate = Number(rate.hourlyRate);
  }
  const price = calculatePrice(hourlyRate, input.startTime, input.endTime, env.TAX_PERCENT);
  return { slot, vehicle, price };
}

/** Price preview. The frontend only displays this; it never calculates money itself. */
export async function quote(userId: string, input: BookingInput) {
  const { slot, price } = await validateBooking(db, userId, input);
  return {
    ...price,
    currency: 'INR',
    slot: { id: slot.id, slotNumber: slot.slotNumber, floor: slot.floor, vehicleType: slot.vehicleType, isEv: slot.isEv },
    area: { id: slot.area.id, name: slot.area.name, address: slot.area.address },
    startTime: input.startTime,
    endTime: input.endTime,
    policy: { ...policy(), paymentHoldMinutes: env.PAYMENT_HOLD_MINUTES },
  };
}

const REF_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const newBookingRef = () => `SPK-${Array.from({ length: 6 }, () => REF_ALPHABET[randomInt(REF_ALPHABET.length)]).join('')}`;

/**
 * Creates a PENDING reservation that holds the slot while the user pays.
 *
 * Double-booking prevention: the slot row is locked with SELECT … FOR UPDATE, so two requests
 * for the same slot run one after the other. The second one then sees the first one's
 * reservation in the overlap check and is rejected with 409.
 */
export async function createReservation(userId: string, input: BookingInput) {
  const id = await db.transaction(async (tx) => {
    const locked = await tx.execute(sql`SELECT id FROM ${parkingSlots} WHERE id = ${input.slotId} FOR UPDATE`);
    if (locked.rows.length === 0) throw notFound('Parking slot');

    // If this user abandoned an earlier checkout for the same slot and time, release that hold first.
    await tx
      .update(reservations)
      .set({ status: 'EXPIRED', updatedAt: new Date() })
      .where(
        and(
          eq(reservations.userId, userId),
          eq(reservations.parkingSlotId, input.slotId),
          eq(reservations.status, 'PENDING'),
          overlaps(input.startTime, input.endTime),
        ),
      );

    const { vehicle, price } = await validateBooking(tx, userId, input);
    const [row] = await tx
      .insert(reservations)
      .values({
        bookingRef: newBookingRef(),
        userId,
        parkingSlotId: input.slotId,
        vehicleId: vehicle?.id,
        vehicleNumber: vehicle?.vehicleNumber,
        startTime: input.startTime,
        endTime: input.endTime,
        billedHours: price.billedHours.toFixed(2),
        hourlyRate: price.hourlyRate.toFixed(2),
        baseAmount: price.baseAmount.toFixed(2),
        taxAmount: price.taxAmount.toFixed(2),
        amount: price.totalAmount.toFixed(2),
      })
      .returning({ id: reservations.id });
    return row.id;
  });
  emitAdminActivity('reservation');
  return toReservationDto((await findById(db, id))!);
}

const TAB_STATUSES: Record<string, ReservationStatus[] | null> = {
  upcoming: ['PENDING', 'CONFIRMED'],
  active: ['ACTIVE'],
  completed: ['COMPLETED'],
  cancelled: ['CANCELLED', 'EXPIRED'],
  all: null,
};

async function paged(where: SQL | undefined, page: number, pageSize: number, upcomingFirst = false) {
  const [rows, [{ total }]] = await Promise.all([
    db.query.reservations.findMany({
      where,
      with: details,
      orderBy: upcomingFirst ? reservations.startTime : desc(reservations.startTime),
      limit: pageSize,
      offset: (page - 1) * pageSize,
    }),
    db.select({ total: count() }).from(reservations).where(where),
  ]);
  return { items: rows.map(toReservationDto), total, page, pageSize };
}

export async function listForUser(userId: string, query: z.infer<typeof reservationQuery>) {
  const statuses = TAB_STATUSES[query.tab];
  const where = and(eq(reservations.userId, userId), statuses ? inArray(reservations.status, statuses) : undefined);
  const [result, tabCounts] = await Promise.all([
    paged(where, query.page, query.pageSize, query.tab === 'upcoming' || query.tab === 'active'),
    db
      .select({ status: reservations.status, n: count() })
      .from(reservations)
      .where(eq(reservations.userId, userId))
      .groupBy(reservations.status),
  ]);
  const by = Object.fromEntries(tabCounts.map((t) => [t.status, t.n])) as Partial<Record<ReservationStatus, number>>;
  const sum = (s: ReservationStatus[]) => s.reduce((acc, k) => acc + (by[k] ?? 0), 0);
  return {
    ...result,
    counts: {
      upcoming: sum(TAB_STATUSES.upcoming!),
      active: sum(TAB_STATUSES.active!),
      completed: sum(TAB_STATUSES.completed!),
      cancelled: sum(TAB_STATUSES.cancelled!),
    },
  };
}

export async function getReservation(id: string, viewer: { id: string; role: 'USER' | 'ADMIN' }) {
  const row = await findById(db, id);
  if (!row) throw notFound('Reservation');
  if (viewer.role !== 'ADMIN' && row.userId !== viewer.id) throw forbidden('This booking belongs to another account.');
  return toReservationDto(row);
}

/**
 * Cancels a reservation and applies the refund policy.
 * Users may cancel before the start time; admins may cancel at any point with a full refund.
 */
export async function cancelReservation(id: string, actor: { id: string; role: 'USER' | 'ADMIN' }, reason?: string) {
  const byAdmin = actor.role === 'ADMIN';
  const outcome = await db.transaction(async (tx) => {
    const locked = await tx.execute(sql`SELECT id FROM ${reservations} WHERE id = ${id} FOR UPDATE`);
    if (locked.rows.length === 0) throw notFound('Reservation');
    const row = (await tx.query.reservations.findFirst({ where: eq(reservations.id, id), with: { payment: true } }))!;
    if (!byAdmin && row.userId !== actor.id) throw forbidden('This booking belongs to another account.');

    const cancellable: ReservationStatus[] = byAdmin ? ['PENDING', 'CONFIRMED', 'ACTIVE'] : ['PENDING', 'CONFIRMED'];
    if (!cancellable.includes(row.status))
      throw conflict(`A ${row.status.toLowerCase()} reservation cannot be cancelled.`, 'CANNOT_CANCEL');

    let refundPercent = 0;
    if (row.status !== 'PENDING') {
      if (byAdmin) refundPercent = 100;
      else {
        const decision = refundPolicy(row.startTime, new Date(), policy());
        if (!decision.allowed) throw conflict(decision.reason, 'CANNOT_CANCEL');
        refundPercent = decision.refundPercent;
      }
    }

    await tx
      .update(reservations)
      .set({
        status: 'CANCELLED',
        cancelledAt: new Date(),
        cancelReason: reason ?? (byAdmin ? 'Cancelled by parking administrator' : 'Cancelled by user'),
        updatedAt: new Date(),
      })
      .where(eq(reservations.id, id));

    let refundAmount = 0;
    if (row.payment?.status === 'SUCCESS') {
      refundAmount = roundMoney((Number(row.payment.amount) * refundPercent) / 100);
      if (refundAmount > 0)
        await tx
          .update(payments)
          .set({ status: 'REFUNDED', refundAmount: refundAmount.toFixed(2), updatedAt: new Date() })
          .where(eq(payments.id, row.payment.id));
    } else if (row.payment?.status === 'PENDING') {
      await tx
        .update(payments)
        .set({ status: 'FAILED', failureReason: 'Reservation cancelled before payment', updatedAt: new Date() })
        .where(eq(payments.id, row.payment.id));
    }
    return { userId: row.userId, refundAmount, payment: row.payment };
  });

  if (outcome.refundAmount > 0 && outcome.payment) void refundOnGateway(outcome.payment, outcome.refundAmount);
  await syncSlotStatuses(db);
  const dto = toReservationDto((await findById(db, id))!);
  emitSlotsChanged(dto.area.id);
  emitAdminActivity('reservation');

  const refundText = outcome.refundAmount > 0 ? ` A refund of ₹${outcome.refundAmount} has been initiated.` : '';
  await notify({
    userId: outcome.userId,
    type: 'BOOKING_CANCELLED',
    title: 'Reservation cancelled',
    message: `Your reservation ${dto.bookingRef} at ${dto.area.name} (slot ${dto.slot.slotNumber}, ${formatDateTime(dto.startTime)}) has been cancelled${byAdmin ? ' by the parking administrator' : ''}.${refundText}`,
    reservationId: id,
  });
  return dto;
}

/** Admin: search and filter all reservations. */
export async function listForAdmin(query: z.infer<typeof adminReservationQuery>) {
  const conditions: Array<SQL | undefined> = [query.status ? eq(reservations.status, query.status) : undefined];
  if (query.areaId)
    conditions.push(
      inArray(reservations.parkingSlotId, db.select({ id: parkingSlots.id }).from(parkingSlots).where(eq(parkingSlots.parkingAreaId, query.areaId))),
    );
  if (query.q) {
    const term = `%${query.q.replace(/[%_]/g, '\\$&')}%`;
    conditions.push(
      or(
        ilike(reservations.bookingRef, term),
        ilike(reservations.vehicleNumber, term),
        inArray(reservations.userId, db.select({ id: users.id }).from(users).where(or(ilike(users.name, term), ilike(users.email, term)))),
        inArray(
          reservations.parkingSlotId,
          db
            .select({ id: parkingSlots.id })
            .from(parkingSlots)
            .innerJoin(parkingAreas, eq(parkingAreas.id, parkingSlots.parkingAreaId))
            .where(or(ilike(parkingSlots.slotNumber, term), ilike(parkingAreas.name, term))),
        ),
      ),
    );
  }
  return paged(and(...conditions), query.page, query.pageSize);
}
