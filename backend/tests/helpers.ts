import { sql } from 'drizzle-orm';
import request from 'supertest';
import { createApp } from '../src/app';
import { db } from '../src/db';
import { operatingHours, parkingAreas, parkingRates, parkingSlots, users } from '../src/db/schema';
import { hashPassword } from '../src/services/auth.service';

export const app = createApp();
export const api = () => request(app);

export async function resetDb() {
  await db.execute(
    sql`TRUNCATE notifications, payments, reservations, vehicles, parking_slots, parking_rates, operating_hours, parking_areas, users RESTART IDENTITY CASCADE`,
  );
}

let counter = 0;
export async function createUser(role: 'USER' | 'ADMIN' = 'USER') {
  counter += 1;
  const email = `${role.toLowerCase()}${counter}@test.local`;
  const password = 'Passw0rd!';
  await db.insert(users).values({ name: `Test ${role} ${counter}`, email, role, passwordHash: await hashPassword(password) });
  const res = await api().post('/api/auth/login').send({ email, password });
  return { email, password, token: res.body.token as string, id: res.body.user.id as string };
}

export const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });

/** A 24x7 area with 4 car slots (₹40/h), 2 bike slots (₹20/h) and 1 EV slot (₹60/h). */
export async function createArea(overrides: Partial<typeof parkingAreas.$inferInsert> = {}) {
  const [area] = await db
    .insert(parkingAreas)
    .values({ name: 'Test Plaza Parking', address: '1 Test Street', city: 'Hyderabad', latitude: 17.4, longitude: 78.4, is24x7: true, ...overrides })
    .returning();
  await db.insert(parkingRates).values([
    { parkingAreaId: area.id, vehicleType: 'CAR', hourlyRate: '40.00' },
    { parkingAreaId: area.id, vehicleType: 'BIKE', hourlyRate: '20.00' },
    { parkingAreaId: area.id, vehicleType: 'EV', hourlyRate: '60.00' },
  ]);
  await db.insert(operatingHours).values(Array.from({ length: 7 }, (_, dayOfWeek) => ({ parkingAreaId: area.id, dayOfWeek, openTime: '08:00', closeTime: '20:00' })));
  const slots = await db
    .insert(parkingSlots)
    .values([
      ...[1, 2, 3, 4].map((n) => ({ parkingAreaId: area.id, slotNumber: `A-10${n}`, vehicleType: 'CAR' as const })),
      ...[1, 2].map((n) => ({ parkingAreaId: area.id, slotNumber: `B-20${n}`, vehicleType: 'BIKE' as const })),
      { parkingAreaId: area.id, slotNumber: 'E-01', vehicleType: 'EV' as const, isEv: true },
    ])
    .returning();
  return { area, slots, car: slots.filter((s) => s.vehicleType === 'CAR'), bike: slots.filter((s) => s.vehicleType === 'BIKE') };
}

const HOUR = 3_600_000;
/** A booking window starting `startInHours` from now, on the hour boundary irrelevant. */
export const window = (startInHours: number, hours = 2) => {
  const startTime = new Date(Date.now() + startInHours * HOUR);
  return { startTime: startTime.toISOString(), endTime: new Date(startTime.getTime() + hours * HOUR).toISOString() };
};

/** Books and pays (simulated gateway) and returns the confirmed reservation. */
export async function bookAndPay(token: string, slotId: string, when = window(3)) {
  const created = await api().post('/api/reservations').set(bearer(token)).send({ slotId, ...when });
  if (created.status !== 201) throw new Error(`booking failed: ${JSON.stringify(created.body)}`);
  await api().post('/api/payments/create-order').set(bearer(token)).send({ reservationId: created.body.id });
  const paid = await api().post('/api/payments/verify').set(bearer(token)).send({ reservationId: created.body.id, mockOutcome: 'success' });
  if (paid.status !== 200) throw new Error(`payment failed: ${JSON.stringify(paid.body)}`);
  return paid.body;
}
