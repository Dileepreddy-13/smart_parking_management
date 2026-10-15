import { and, count, desc, eq, ilike, inArray, or, sql, type SQL } from 'drizzle-orm';
import type { z } from 'zod';
import { env } from '../config/env';
import { db } from '../db';
import { payments, reservations, users } from '../db/schema';
import { emitAdminActivity, emitSlotsChanged } from '../sockets';
import { AppError, badRequest, conflict, forbidden, notFound } from '../utils/errors';
import { formatDateTime } from '../utils/time';
import type { adminPaymentQuery, verifyPaymentSchema } from '../validators';
import { syncSlotStatuses } from './availability';
import { notify } from './notification.service';
import { createGatewayOrder, isValidSignature, newMockPaymentId, provider } from './payment.gateway';
import { getReservation } from './reservation.service';

type Viewer = { id: string; role: 'USER' | 'ADMIN' };

const holdExpired = (createdAt: Date) => createdAt.getTime() + env.PAYMENT_HOLD_MINUTES * 60_000 < Date.now();

async function payableReservation(reservationId: string, userId: string) {
  const reservation = await db.query.reservations.findFirst({ where: eq(reservations.id, reservationId), with: { payment: true } });
  if (!reservation) throw notFound('Reservation');
  if (reservation.userId !== userId) throw forbidden('This booking belongs to another account.');
  if (reservation.status !== 'PENDING')
    throw conflict(
      reservation.status === 'EXPIRED' ? 'This booking expired before payment. Please book again.' : 'This booking is not awaiting payment.',
      'NOT_PAYABLE',
    );
  if (holdExpired(reservation.createdAt)) throw conflict('This booking expired before payment. Please book again.', 'NOT_PAYABLE');
  return reservation;
}

/** Step 1 of checkout: create (or re-create after a failure) the gateway order for a pending reservation. */
export async function createOrder(reservationId: string, userId: string) {
  const reservation = await payableReservation(reservationId, userId);
  const amount = Number(reservation.amount);
  let orderId: string;
  try {
    orderId = await createGatewayOrder(amount, reservation.bookingRef);
  } catch (err) {
    console.error('[payment] order creation failed:', err);
    throw new AppError(502, 'PAYMENT_GATEWAY_ERROR', 'The payment gateway is not responding. Please try again.');
  }

  const values = { amount: reservation.amount, status: 'PENDING' as const, provider, razorpayOrderId: orderId, razorpayPaymentId: null, failureReason: null };
  const [payment] = await db
    .insert(payments)
    .values({ reservationId, userId, ...values })
    .onConflictDoUpdate({ target: payments.reservationId, set: { ...values, updatedAt: new Date() } })
    .returning();

  return {
    paymentId: payment.id,
    orderId,
    amount,
    amountInPaise: Math.round(amount * 100),
    currency: 'INR',
    provider,
    /** Public key only. The key secret never leaves the server. */
    keyId: provider === 'RAZORPAY' ? env.RAZORPAY_KEY_ID : null,
    bookingRef: reservation.bookingRef,
  };
}

/**
 * Step 2 of checkout: verify the gateway's answer and confirm the reservation.
 * The reservation is only ever confirmed here, on the server, after verification.
 */
export async function verifyPayment(input: z.infer<typeof verifyPaymentSchema>, userId: string) {
  const reservation = await payableReservation(input.reservationId, userId);
  const payment = reservation.payment;
  if (!payment || !payment.razorpayOrderId) throw badRequest('Start the payment before verifying it.', 'NO_ORDER');

  let gatewayPaymentId: string;
  let failure: string | null = null;

  if (payment.provider === 'MOCK') {
    if (provider !== 'MOCK' || !input.mockOutcome) throw badRequest('Invalid payment response.', 'PAYMENT_INVALID');
    gatewayPaymentId = newMockPaymentId();
    if (input.mockOutcome === 'failure') failure = 'Payment declined (simulated)';
  } else if (input.failureReason) {
    gatewayPaymentId = input.razorpayPaymentId ?? '';
    failure = input.failureReason;
  } else {
    if (!input.razorpayOrderId || !input.razorpayPaymentId || !input.razorpaySignature)
      throw badRequest('Incomplete payment response.', 'PAYMENT_INVALID');
    gatewayPaymentId = input.razorpayPaymentId;
    if (input.razorpayOrderId !== payment.razorpayOrderId || !isValidSignature(input.razorpayOrderId, input.razorpayPaymentId, input.razorpaySignature))
      failure = 'Payment signature verification failed';
  }

  if (failure) {
    await db
      .update(payments)
      .set({ status: 'FAILED', failureReason: failure, razorpayPaymentId: gatewayPaymentId || null, updatedAt: new Date() })
      .where(eq(payments.id, payment.id));
    emitAdminActivity('payment');
    throw new AppError(402, 'PAYMENT_FAILED', `${failure}. Your slot is still held — you can retry the payment.`);
  }

  await db.transaction(async (tx) => {
    // Lock the reservation so the expiry job cannot release it while we confirm.
    const locked = await tx.execute<{ status: string }>(sql`SELECT status FROM ${reservations} WHERE id = ${reservation.id} FOR UPDATE`);
    if (locked.rows[0]?.status !== 'PENDING') throw conflict('This booking is no longer awaiting payment.', 'NOT_PAYABLE');
    const now = new Date();
    await tx
      .update(payments)
      .set({ status: 'SUCCESS', razorpayPaymentId: gatewayPaymentId, paidAt: now, failureReason: null, updatedAt: now })
      .where(eq(payments.id, payment.id));
    await tx
      .update(reservations)
      .set({ status: reservation.startTime <= now ? 'ACTIVE' : 'CONFIRMED', updatedAt: now })
      .where(eq(reservations.id, reservation.id));
  });

  await syncSlotStatuses(db);
  const dto = await getReservation(reservation.id, { id: userId, role: 'USER' });
  emitSlotsChanged(dto.area.id);
  emitAdminActivity('payment');

  await notify({
    userId,
    type: 'BOOKING_CONFIRMATION',
    title: 'Booking confirmed',
    message: `Your parking reservation at ${dto.area.name} has been confirmed. Slot ${dto.slot.slotNumber}, ${formatDateTime(dto.startTime)} – ${formatDateTime(dto.endTime)}. Booking ID ${dto.bookingRef}.`,
    reservationId: dto.id,
  });
  await notify({
    userId,
    type: 'PAYMENT_SUCCESS',
    title: 'Payment successful',
    message: `Payment of ₹${dto.amount} was successful for booking ${dto.bookingRef}.`,
    reservationId: dto.id,
  });
  return dto;
}

const paymentDetails = {
  reservation: { columns: { id: true, bookingRef: true, startTime: true, endTime: true, status: true } },
  user: { columns: { id: true, name: true, email: true } },
} as const;

type PaymentRow = NonNullable<Awaited<ReturnType<typeof findPayment>>>;
const findPayment = (id: string) => db.query.payments.findFirst({ where: eq(payments.id, id), with: paymentDetails });
const toPaymentDto = (p: PaymentRow) => ({
  ...p,
  amount: Number(p.amount),
  refundAmount: p.refundAmount === null ? null : Number(p.refundAmount),
});

export async function getPayment(id: string, viewer: Viewer) {
  const payment = await findPayment(id);
  if (!payment) throw notFound('Payment');
  if (viewer.role !== 'ADMIN' && payment.userId !== viewer.id) throw forbidden();
  return toPaymentDto(payment);
}

async function pagedPayments(where: SQL | undefined, page: number, pageSize: number) {
  const [rows, [{ total }]] = await Promise.all([
    db.query.payments.findMany({ where, with: paymentDetails, orderBy: desc(payments.createdAt), limit: pageSize, offset: (page - 1) * pageSize }),
    db.select({ total: count() }).from(payments).where(where),
  ]);
  return { items: rows.map(toPaymentDto), total, page, pageSize };
}

export const listForUser = (userId: string, limit = 20) => pagedPayments(eq(payments.userId, userId), 1, limit);

export function listForAdmin(query: z.infer<typeof adminPaymentQuery>) {
  const conditions: Array<SQL | undefined> = [query.status ? eq(payments.status, query.status) : undefined];
  if (query.q) {
    const term = `%${query.q.replace(/[%_]/g, '\\$&')}%`;
    conditions.push(
      or(
        ilike(payments.razorpayOrderId, term),
        ilike(payments.razorpayPaymentId, term),
        inArray(payments.userId, db.select({ id: users.id }).from(users).where(or(ilike(users.name, term), ilike(users.email, term)))),
        inArray(payments.reservationId, db.select({ id: reservations.id }).from(reservations).where(ilike(reservations.bookingRef, term))),
      ),
    );
  }
  return pagedPayments(and(...conditions), query.page, query.pageSize);
}
