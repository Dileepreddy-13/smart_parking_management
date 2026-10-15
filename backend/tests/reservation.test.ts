import { eq } from 'drizzle-orm';
import { beforeAll, describe, expect, it } from 'vitest';
import { db } from '../src/db';
import { parkingSlots, reservations } from '../src/db/schema';
import { runLifecycle } from '../src/jobs/reservationLifecycle';
import { api, bearer, bookAndPay, createArea, createUser, resetDb, window } from './helpers';

type Fixture = Awaited<ReturnType<typeof createArea>>;
type TestUser = Awaited<ReturnType<typeof createUser>>;

describe('reservations, payments and notifications', () => {
  let f: Fixture;
  let alice: TestUser;
  let bob: TestUser;
  let admin: TestUser;

  beforeAll(async () => {
    await resetDb();
    f = await createArea();
    [alice, bob, admin] = await Promise.all([createUser(), createUser(), createUser('ADMIN')]);
  });

  it('quotes the price on the server (₹40/h × 2h + 18% tax)', async () => {
    const res = await api().post('/api/reservations/quote').set(bearer(alice.token)).send({ slotId: f.car[0].id, ...window(3, 2) });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ billedHours: 2, hourlyRate: 40, baseAmount: 80, taxAmount: 14.4, totalAmount: 94.4 });
  });

  it('TC-07 creates a pending reservation for an available slot', async () => {
    const res = await api().post('/api/reservations').set(bearer(alice.token)).send({ slotId: f.car[0].id, ...window(3, 2) });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ status: 'PENDING', amount: 94.4, slot: { slotNumber: 'A-101' }, area: { name: 'Test Plaza Parking' } });
    expect(res.body.bookingRef).toMatch(/^SPK-[A-Z0-9]{6}$/);
    expect(res.body.payBy).toBeTruthy();
  });

  it('TC-08 rejects a second booking that overlaps the same slot', async () => {
    const overlap = { startTime: new Date(Date.now() + 4 * 3_600_000).toISOString(), endTime: new Date(Date.now() + 6 * 3_600_000).toISOString() };
    const res = await api().post('/api/reservations').set(bearer(bob.token)).send({ slotId: f.car[0].id, ...overlap });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('SLOT_ALREADY_RESERVED');
    // …but a window that starts when the first one ends is fine.
    const after = await api().post('/api/reservations/quote').set(bearer(bob.token)).send({ slotId: f.car[0].id, ...window(5.01, 1) });
    expect(after.status).toBe(200);
  });

  it('allows exactly one winner when many users book the same slot at the same instant', async () => {
    const users = await Promise.all(Array.from({ length: 8 }, () => createUser()));
    const when = window(30, 2);
    const results = await Promise.all(users.map((u) => api().post('/api/reservations').set(bearer(u.token)).send({ slotId: f.car[1].id, ...when })));
    const statuses = results.map((r) => r.status).sort();
    expect(statuses.filter((s) => s === 201)).toHaveLength(1);
    expect(statuses.filter((s) => s === 409)).toHaveLength(7);
    const rows = await db.select().from(reservations).where(eq(reservations.parkingSlotId, f.car[1].id));
    expect(rows).toHaveLength(1);
  });

  it('rejects invalid time ranges, maintenance slots and unknown slots', async () => {
    const post = (body: object) => api().post('/api/reservations').set(bearer(alice.token)).send(body);
    const start = new Date(Date.now() + 3 * 3_600_000);
    const backwards = await post({ slotId: f.car[2].id, startTime: start.toISOString(), endTime: new Date(start.getTime() - 60_000).toISOString() });
    expect(backwards.body.error.code).toBe('INVALID_TIME_RANGE');
    expect((await post({ slotId: f.car[2].id, ...window(-5, 1) })).body.error.code).toBe('INVALID_TIME_RANGE');
    expect((await post({ slotId: f.car[2].id, ...window(2, 0.1) })).body.error.code).toBe('INVALID_TIME_RANGE');
    expect((await post({ slotId: f.car[2].id, ...window(2, 30) })).body.error.code).toBe('INVALID_TIME_RANGE');
    expect((await post({ slotId: '00000000-0000-4000-8000-000000000000', ...window(2) })).status).toBe(404);
    expect((await post({ slotId: f.car[2].id })).status).toBe(400);

    await db.update(parkingSlots).set({ status: 'MAINTENANCE' }).where(eq(parkingSlots.id, f.car[3].id));
    const maintenance = await post({ slotId: f.car[3].id, ...window(2) });
    expect(maintenance.status).toBe(409);
    expect(maintenance.body.error.code).toBe('SLOT_UNAVAILABLE');
    await db.update(parkingSlots).set({ status: 'AVAILABLE' }).where(eq(parkingSlots.id, f.car[3].id));
  });

  it('enforces operating hours for areas that are not open 24x7', async () => {
    const day = await createArea({ name: 'Daytime Only Lot', is24x7: false });
    const tomorrow = new Date(Date.now() + 86_400_000);
    const istMidnight = new Date(Date.UTC(tomorrow.getUTCFullYear(), tomorrow.getUTCMonth(), tomorrow.getUTCDate(), 18, 30)); // 00:00 IST
    const at = (hour: number) => new Date(istMidnight.getTime() + hour * 3_600_000).toISOString();
    const post = (startHour: number, endHour: number) =>
      api().post('/api/reservations/quote').set(bearer(alice.token)).send({ slotId: day.car[0].id, startTime: at(startHour), endTime: at(endHour) });
    expect((await post(10, 12)).status).toBe(200); // inside 08:00–20:00
    expect((await post(6, 9)).body.error.code).toBe('PARKING_CLOSED'); // before opening
    expect((await post(19, 21)).body.error.code).toBe('PARKING_CLOSED'); // after closing
  });

  it('TC-10 a failed payment leaves the booking unconfirmed and can be retried', async () => {
    const created = await api().post('/api/reservations').set(bearer(bob.token)).send({ slotId: f.car[2].id, ...window(8, 1) });
    const id = created.body.id;
    expect((await api().post('/api/payments/verify').set(bearer(bob.token)).send({ reservationId: id, mockOutcome: 'success' })).body.error.code).toBe('NO_ORDER');

    const order = await api().post('/api/payments/create-order').set(bearer(bob.token)).send({ reservationId: id });
    expect(order.status).toBe(201);
    expect(order.body).toMatchObject({ amount: 47.2, amountInPaise: 4720, currency: 'INR', provider: 'MOCK', keyId: null });
    expect(JSON.stringify(order.body)).not.toMatch(/secret/i);

    const failed = await api().post('/api/payments/verify').set(bearer(bob.token)).send({ reservationId: id, mockOutcome: 'failure' });
    expect(failed.status).toBe(402);
    expect(failed.body.error.code).toBe('PAYMENT_FAILED');
    const afterFail = await api().get(`/api/reservations/${id}`).set(bearer(bob.token));
    expect(afterFail.body).toMatchObject({ status: 'PENDING', payment: { status: 'FAILED' } });

    // Someone else cannot pay for (or see) Bob's booking.
    expect((await api().post('/api/payments/create-order').set(bearer(alice.token)).send({ reservationId: id })).status).toBe(403);
    expect((await api().get(`/api/reservations/${id}`).set(bearer(alice.token))).status).toBe(403);

    await api().post('/api/payments/create-order').set(bearer(bob.token)).send({ reservationId: id }).expect(201);
    const paid = await api().post('/api/payments/verify').set(bearer(bob.token)).send({ reservationId: id, mockOutcome: 'success' });
    expect(paid.status).toBe(200);
    expect(paid.body).toMatchObject({ status: 'CONFIRMED', payment: { status: 'SUCCESS', amount: 47.2 } });
    // A confirmed booking cannot be paid twice.
    expect((await api().post('/api/payments/verify').set(bearer(bob.token)).send({ reservationId: id, mockOutcome: 'success' })).status).toBe(409);
  });

  it('TC-09 / TC-15 a successful payment confirms the booking and creates notifications', async () => {
    const carol = await createUser();
    const booking = await bookAndPay(carol.token, f.bike[0].id, window(6, 2));
    expect(booking).toMatchObject({ status: 'CONFIRMED', amount: 47.2, payment: { status: 'SUCCESS', provider: 'MOCK' } });
    expect(booking.payment.razorpayPaymentId).toMatch(/^pay_mock_/);

    const inbox = await api().get('/api/notifications').set(bearer(carol.token));
    expect(inbox.body.unread).toBe(2);
    expect(inbox.body.items.map((n: { type: string }) => n.type).sort()).toEqual(['BOOKING_CONFIRMATION', 'PAYMENT_SUCCESS']);
    expect(inbox.body.items.find((n: { type: string }) => n.type === 'PAYMENT_SUCCESS').message).toBe(`Payment of ₹47.2 was successful for booking ${booking.bookingRef}.`);

    const one = await api().patch(`/api/notifications/${inbox.body.items[0].id}/read`).set(bearer(carol.token));
    expect(one.body.isRead).toBe(true);
    expect((await api().patch(`/api/notifications/${inbox.body.items[0].id}/read`).set(bearer(alice.token))).status).toBe(404);
    expect((await api().patch('/api/notifications/read-all').set(bearer(carol.token))).body.updated).toBe(1);
    expect((await api().get('/api/notifications').set(bearer(carol.token))).body.unread).toBe(0);

    const list = await api().get('/api/reservations?tab=upcoming').set(bearer(carol.token));
    expect(list.body.items).toHaveLength(1);
    expect(list.body.counts).toMatchObject({ upcoming: 1, active: 0, completed: 0, cancelled: 0 });
    const payment = await api().get(`/api/payments/${booking.payment.id}`).set(bearer(carol.token));
    expect(payment.body).toMatchObject({ status: 'SUCCESS', amount: 47.2, currency: 'INR' });
    const dash = await api().get('/api/dashboard').set(bearer(carol.token));
    expect(dash.body.stats).toMatchObject({ totalBookings: 1, totalSpent: 47.2 });
    expect(dash.body.upcomingReservation.id).toBe(booking.id);
  });

  it('TC-11 cancels with a full refund early and a partial refund late; frees the slot', async () => {
    const dave = await createUser();
    const early = await bookAndPay(dave.token, f.bike[1].id, window(5, 1)); // ₹20 + 18% = 23.6
    const cancelled = await api().patch(`/api/reservations/${early.id}/cancel`).set(bearer(dave.token)).send({ reason: 'Plans changed' });
    expect(cancelled.status).toBe(200);
    expect(cancelled.body).toMatchObject({ status: 'CANCELLED', cancelReason: 'Plans changed', payment: { status: 'REFUNDED', refundAmount: 23.6 } });
    expect((await api().patch(`/api/reservations/${early.id}/cancel`).set(bearer(dave.token))).status).toBe(409);

    // The slot can be booked again for the same time.
    const late = await bookAndPay(dave.token, f.bike[1].id, window(0.5, 1)); // starts in 30 min → inside the late window
    expect(late.cancellation).toMatchObject({ allowed: true, refundPercent: 50 });
    const lateCancel = await api().patch(`/api/reservations/${late.id}/cancel`).set(bearer(dave.token));
    expect(lateCancel.body.payment).toMatchObject({ status: 'REFUNDED', refundAmount: 11.8 });

    const inbox = await api().get('/api/notifications').set(bearer(dave.token));
    expect(inbox.body.items.filter((n: { type: string }) => n.type === 'BOOKING_CANCELLED')).toHaveLength(2);
  });

  it('marks the slot RESERVED around the booking and releases it when the booking ends', async () => {
    const erin = await createUser();
    const lot = await createArea({ name: 'Lifecycle Lot' });
    const slotId = lot.car[0].id;
    const status = async () => (await db.query.parkingSlots.findFirst({ where: eq(parkingSlots.id, slotId) }))!.status;

    const far = await bookAndPay(erin.token, slotId, window(10, 1));
    expect(await status()).toBe('AVAILABLE'); // booking is hours away, the bay is free right now
    await api().patch(`/api/reservations/${far.id}/cancel`).set(bearer(erin.token)).expect(200);

    const soon = await bookAndPay(erin.token, slotId, window(0.2, 1)); // starts in 12 minutes
    expect(await status()).toBe('RESERVED');
    expect((await api().get(`/api/parking/${lot.area.id}`)).body.counts.RESERVED).toBe(1);

    // Reminder goes out once; then start → ACTIVE; then end → COMPLETED and the slot is freed.
    expect((await runLifecycle()).reminders).toBe(1);
    expect((await runLifecycle()).reminders).toBe(0);
    await db.update(reservations).set({ startTime: new Date(Date.now() - 60_000) }).where(eq(reservations.id, soon.id));
    expect((await runLifecycle()).started).toBe(1);
    expect((await api().get(`/api/reservations/${soon.id}`).set(bearer(erin.token))).body.status).toBe('ACTIVE');
    expect((await api().patch(`/api/reservations/${soon.id}/cancel`).set(bearer(erin.token))).status).toBe(409); // already started

    await db.update(parkingSlots).set({ status: 'OCCUPIED' }).where(eq(parkingSlots.id, slotId)); // the car arrives
    await db.update(reservations).set({ endTime: new Date(Date.now() - 1000) }).where(eq(reservations.id, soon.id));
    expect((await runLifecycle()).completed).toBe(1);
    expect((await api().get(`/api/reservations/${soon.id}`).set(bearer(erin.token))).body.status).toBe('COMPLETED');
    expect(await status()).toBe('AVAILABLE');
    const inbox = await api().get('/api/notifications').set(bearer(erin.token));
    expect(inbox.body.items.some((n: { type: string }) => n.type === 'BOOKING_REMINDER')).toBe(true);
  });

  it('expires unpaid reservations after the payment hold and releases the slot', async () => {
    const frank = await createUser();
    const lot = await createArea({ name: 'Expiry Lot' });
    const when = window(4, 1);
    const pending = await api().post('/api/reservations').set(bearer(frank.token)).send({ slotId: lot.car[0].id, ...when });
    expect((await api().post('/api/reservations/quote').set(bearer(bob.token)).send({ slotId: lot.car[0].id, ...when })).status).toBe(409);

    await db.update(reservations).set({ createdAt: new Date(Date.now() - 11 * 60_000) }).where(eq(reservations.id, pending.body.id));
    // Even before the job runs, an expired hold no longer blocks others and cannot be paid.
    expect((await api().post('/api/reservations/quote').set(bearer(bob.token)).send({ slotId: lot.car[0].id, ...when })).status).toBe(200);
    expect((await api().post('/api/payments/create-order').set(bearer(frank.token)).send({ reservationId: pending.body.id })).status).toBe(409);
    expect((await runLifecycle()).expired).toBe(1);
    expect((await api().get(`/api/reservations/${pending.body.id}`).set(bearer(frank.token))).body.status).toBe('EXPIRED');
  });

  it('gives admins real statistics, search, cancellation with full refund and user management', async () => {
    const dash = await api().get('/api/admin/dashboard').set(bearer(admin.token));
    expect(dash.status).toBe(200);
    expect(dash.body.stats.totalParkingAreas).toBe(4);
    expect(dash.body.stats.totalSlots).toBe(28);
    expect(dash.body.stats.todaysRevenue).toBeGreaterThan(0);
    expect(dash.body.charts.overTime).toHaveLength(14);
    expect(dash.body.charts.occupancyByArea).toHaveLength(4);

    const revenue = await api().get('/api/admin/revenue?days=7').set(bearer(admin.token));
    expect(revenue.body.totals.net).toBeCloseTo(revenue.body.totals.gross - revenue.body.totals.refunds, 2);
    expect(revenue.body.totals.refunds).toBeCloseTo(23.6 + 11.8 + 47.2, 2);
    expect(revenue.body.peakHours).toHaveLength(24);

    const confirmed = await api().get('/api/admin/reservations?status=CONFIRMED').set(bearer(admin.token));
    expect(confirmed.body.items.length).toBeGreaterThan(0);
    const target = confirmed.body.items[0];
    const search = await api().get(`/api/admin/reservations?q=${target.bookingRef}`).set(bearer(admin.token));
    expect(search.body.items).toHaveLength(1);
    const byArea = await api().get(`/api/admin/reservations?areaId=${f.area.id}`).set(bearer(admin.token));
    expect(byArea.body.items.every((r: { area: { id: string } }) => r.area.id === f.area.id)).toBe(true);

    const cancelled = await api().patch(`/api/admin/reservations/${target.id}/cancel`).set(bearer(admin.token)).send({});
    expect(cancelled.body).toMatchObject({ status: 'CANCELLED', payment: { status: 'REFUNDED', refundAmount: target.amount } });

    const payments = await api().get('/api/admin/payments?status=REFUNDED').set(bearer(admin.token));
    expect(payments.body.items.length).toBeGreaterThanOrEqual(3);

    const users = await api().get('/api/admin/users?pageSize=100').set(bearer(admin.token));
    expect(JSON.stringify(users.body)).not.toMatch(/password/i);
    const bobRow = users.body.items.find((u: { id: string }) => u.id === bob.id);
    expect(bobRow.bookings).toBeGreaterThan(0);

    expect((await api().patch(`/api/admin/users/${admin.id}/status`).set(bearer(admin.token)).send({ status: 'INACTIVE' })).status).toBe(400);
    await api().patch(`/api/admin/users/${bob.id}/status`).set(bearer(admin.token)).send({ status: 'INACTIVE' }).expect(200);
    expect((await api().get('/api/auth/me').set(bearer(bob.token))).body.error.code).toBe('ACCOUNT_INACTIVE');
    expect((await api().post('/api/auth/login').send({ email: bob.email, password: bob.password })).status).toBe(403);
    await api().patch(`/api/admin/users/${bob.id}/status`).set(bearer(admin.token)).send({ status: 'ACTIVE' }).expect(200);

    const sent = await api().post('/api/admin/notifications').set(bearer(admin.token)).send({ title: 'Maintenance tonight', message: 'Level 2 is closed from 22:00.' });
    expect(sent.status).toBe(201);
    expect(sent.body.sent).toBeGreaterThan(5);
    expect((await api().get('/api/notifications').set(bearer(alice.token))).body.items[0]).toMatchObject({ type: 'SYSTEM', title: 'Maintenance tonight' });
  });
});
