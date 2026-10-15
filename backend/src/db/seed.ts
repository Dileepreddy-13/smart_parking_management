/**
 * Development seed data. Wipes every table and loads a realistic demo data set.
 * All accounts below are FAKE demo accounts for local development only.
 */
import { sql } from 'drizzle-orm';
import { env } from '../config/env';
import { hashPassword } from '../services/auth.service';
import { syncSlotStatuses } from '../services/availability';
import { calculatePrice, roundMoney } from '../utils/pricing';
import { startOfLocalDay } from '../utils/time';
import { db, pool } from './index';
import {
  notifications,
  operatingHours,
  parkingAreas,
  parkingRates,
  parkingSlots,
  payments,
  reservations,
  users,
  vehicles,
  type VehicleType,
} from './schema';

export const DEMO = {
  admin: { email: 'admin@smartparking.local', password: 'Admin@123' },
  user: { email: 'user@smartparking.local', password: 'User@123' },
};

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

interface AreaSeed {
  name: string;
  description: string;
  address: string;
  latitude: number;
  longitude: number;
  is24x7: boolean;
  open: string;
  close: string;
  rates: Record<VehicleType, number>;
  layout: { cars: number; bikes: number; ev: number };
}

const AREAS: AreaSeed[] = [
  {
    name: 'CBIT Main Parking',
    description: 'Campus parking next to the main gate. Covered two-wheeler bays and a row of visitor car slots.',
    address: 'CBIT Campus, Gandipet, Hyderabad 500075',
    latitude: 17.392,
    longitude: 78.3194,
    is24x7: false,
    open: '07:00',
    close: '21:00',
    rates: { BIKE: 10, CAR: 30, EV: 40 },
    layout: { cars: 10, bikes: 12, ev: 2 },
  },
  {
    name: 'Hyderabad Central Parking',
    description: 'Multi-level parking in Punjagutta, a short walk from the metro station and shopping district.',
    address: 'Punjagutta Cross Roads, Hyderabad 500082',
    latitude: 17.4265,
    longitude: 78.452,
    is24x7: false,
    open: '08:00',
    close: '23:00',
    rates: { BIKE: 20, CAR: 50, EV: 70 },
    layout: { cars: 16, bikes: 8, ev: 4 },
  },
  {
    name: 'Gachibowli Metro Parking',
    description: 'Park-and-ride facility for commuters heading into the Financial District.',
    address: 'Old Mumbai Highway, Gachibowli, Hyderabad 500032',
    latitude: 17.4401,
    longitude: 78.3489,
    is24x7: false,
    open: '06:00',
    close: '23:00',
    rates: { BIKE: 15, CAR: 40, EV: 55 },
    layout: { cars: 12, bikes: 10, ev: 2 },
  },
  {
    name: 'HITEC City Parking',
    description: 'Round-the-clock parking for the IT corridor with CCTV coverage and fast EV chargers.',
    address: 'Cyber Towers Road, HITEC City, Hyderabad 500081',
    latitude: 17.4474,
    longitude: 78.3762,
    is24x7: true,
    open: '00:00',
    close: '23:59',
    rates: { BIKE: 20, CAR: 60, EV: 80 },
    layout: { cars: 18, bikes: 6, ev: 6 },
  },
  {
    name: 'Madhapur Smart Parking',
    description: 'Compact street-level lot near Durgam Cheruvu, popular in the evenings.',
    address: 'Ayyappa Society Main Road, Madhapur, Hyderabad 500081',
    latitude: 17.4483,
    longitude: 78.3915,
    is24x7: false,
    open: '06:00',
    close: '23:30',
    rates: { BIKE: 15, CAR: 45, EV: 60 },
    layout: { cars: 10, bikes: 6, ev: 2 },
  },
];

const PEOPLE = [
  { name: 'Demo User', email: DEMO.user.email, phone: '+91 90000 00001', vehicles: [['TS09AB1234', 'CAR'], ['TS07XY4321', 'BIKE']] },
  { name: 'Ananya Reddy', email: 'ananya@smartparking.local', phone: '+91 90000 00002', vehicles: [['TS08CD5678', 'CAR']] },
  { name: 'Rahul Verma', email: 'rahul@smartparking.local', phone: '+91 90000 00003', vehicles: [['TS10EV0042', 'EV']] },
  { name: 'Sneha Iyer', email: 'sneha@smartparking.local', phone: '+91 90000 00004', vehicles: [['TS11GH2468', 'BIKE']] },
  { name: 'Karthik Rao', email: 'karthik@smartparking.local', phone: '+91 90000 00005', vehicles: [['TS12JK1357', 'CAR']] },
] as const;

async function seed() {
  console.log('Resetting tables…');
  await db.execute(sql`TRUNCATE ${notifications}, ${payments}, ${reservations}, ${vehicles}, ${parkingSlots}, ${parkingRates}, ${operatingHours}, ${parkingAreas}, ${users} RESTART IDENTITY CASCADE`);

  // ---- Users --------------------------------------------------------------
  const userHash = await hashPassword(DEMO.user.password);
  await db.insert(users).values({
    name: 'Parking Admin',
    email: DEMO.admin.email,
    phone: '+91 90000 00000',
    role: 'ADMIN',
    passwordHash: await hashPassword(DEMO.admin.password),
    createdAt: new Date(Date.now() - 60 * DAY),
  });
  const people = await db
    .insert(users)
    .values(PEOPLE.map((p, i) => ({ name: p.name, email: p.email, phone: p.phone, passwordHash: userHash, createdAt: new Date(Date.now() - (40 - i * 6) * DAY) })))
    .returning();
  const vehicleRows = await db
    .insert(vehicles)
    .values(PEOPLE.flatMap((p, i) => p.vehicles.map(([vehicleNumber, vehicleType]) => ({ userId: people[i].id, vehicleNumber, vehicleType }))))
    .returning();

  // ---- Parking areas, rates, hours and slots ------------------------------
  const slotsByArea = new Map<string, Array<typeof parkingSlots.$inferSelect>>();
  const rateByArea = new Map<string, Record<VehicleType, number>>();
  for (const a of AREAS) {
    const [area] = await db
      .insert(parkingAreas)
      .values({ name: a.name, description: a.description, address: a.address, city: 'Hyderabad', latitude: a.latitude, longitude: a.longitude, is24x7: a.is24x7 })
      .returning();
    await db.insert(parkingRates).values((Object.keys(a.rates) as VehicleType[]).map((vehicleType) => ({ parkingAreaId: area.id, vehicleType, hourlyRate: a.rates[vehicleType].toFixed(2) })));
    await db.insert(operatingHours).values(Array.from({ length: 7 }, (_, dayOfWeek) => ({ parkingAreaId: area.id, dayOfWeek, openTime: a.open, closeTime: a.close })));

    const slotValues: Array<typeof parkingSlots.$inferInsert> = [];
    for (let i = 1; i <= a.layout.cars; i++) slotValues.push({ parkingAreaId: area.id, slotNumber: `A-${100 + i}`, floor: '1', vehicleType: 'CAR' });
    for (let i = 1; i <= a.layout.bikes; i++) slotValues.push({ parkingAreaId: area.id, slotNumber: `B-${200 + i}`, floor: '2', vehicleType: 'BIKE' });
    for (let i = 1; i <= a.layout.ev; i++) slotValues.push({ parkingAreaId: area.id, slotNumber: `E-${String(i).padStart(2, '0')}`, floor: '1', vehicleType: 'EV', isEv: true });
    // A few bays are in use or out of service so the occupancy screens have something to show.
    slotValues.forEach((s, i) => {
      if (i % 7 === 3) s.status = 'OCCUPIED';
      if (i % 13 === 9) s.status = 'MAINTENANCE';
    });
    slotsByArea.set(a.name, await db.insert(parkingSlots).values(slotValues).returning());
    rateByArea.set(a.name, a.rates);
  }

  // ---- Reservations & payments --------------------------------------------
  const now = Date.now();
  /** `hour` o'clock (app timezone) on the day `dayOffset` days from today. */
  const atHour = (dayOffset: number, hour: number) => new Date(startOfLocalDay().getTime() + dayOffset * DAY + hour * HOUR);
  let refCounter = 0;
  const freeSlot = (areaName: string, type: VehicleType, index: number) =>
    slotsByArea.get(areaName)!.filter((s) => s.vehicleType === type && s.status === 'AVAILABLE')[index];

  async function book(opts: {
    person: number;
    area: string;
    type: VehicleType;
    slotIndex: number;
    start: Date;
    hours: number;
    status: 'COMPLETED' | 'CONFIRMED' | 'ACTIVE' | 'CANCELLED';
    refundPercent?: number;
  }) {
    const user = people[opts.person];
    const slot = freeSlot(opts.area, opts.type, opts.slotIndex);
    const end = new Date(opts.start.getTime() + opts.hours * HOUR);
    const price = calculatePrice(rateByArea.get(opts.area)![opts.type], opts.start, end, env.TAX_PERCENT);
    const vehicle = vehicleRows.find((v) => v.userId === user.id && (v.vehicleType === opts.type || (v.vehicleType === 'EV' && opts.type === 'CAR')));
    const bookedAt = new Date(Math.min(opts.start.getTime() - 3 * HOUR, now - 5 * 60_000));
    refCounter += 1;
    const [reservation] = await db
      .insert(reservations)
      .values({
        bookingRef: `SPK-DEMO${String(refCounter).padStart(2, '0')}`,
        userId: user.id,
        parkingSlotId: slot.id,
        vehicleId: vehicle?.id,
        vehicleNumber: vehicle?.vehicleNumber,
        startTime: opts.start,
        endTime: end,
        billedHours: price.billedHours.toFixed(2),
        hourlyRate: price.hourlyRate.toFixed(2),
        baseAmount: price.baseAmount.toFixed(2),
        taxAmount: price.taxAmount.toFixed(2),
        amount: price.totalAmount.toFixed(2),
        status: opts.status,
        reminderSent: opts.status !== 'CONFIRMED',
        cancelledAt: opts.status === 'CANCELLED' ? new Date(bookedAt.getTime() + HOUR) : null,
        cancelReason: opts.status === 'CANCELLED' ? 'Cancelled by user' : null,
        createdAt: bookedAt,
      })
      .returning();
    const refund = opts.status === 'CANCELLED' ? roundMoney((price.totalAmount * (opts.refundPercent ?? 100)) / 100) : null;
    await db.insert(payments).values({
      reservationId: reservation.id,
      userId: user.id,
      amount: price.totalAmount.toFixed(2),
      status: refund ? 'REFUNDED' : 'SUCCESS',
      provider: 'MOCK',
      razorpayOrderId: `order_mock_seed${String(refCounter).padStart(4, '0')}`,
      razorpayPaymentId: `pay_mock_seed${String(refCounter).padStart(4, '0')}`,
      refundAmount: refund?.toFixed(2),
      paidAt: bookedAt,
      createdAt: bookedAt,
    });
    return { reservation, area: opts.area, slot, amount: price.totalAmount };
  }

  // Two weeks of history so the admin charts are populated.
  const areaNames = AREAS.map((a) => a.name);
  const types: VehicleType[] = ['CAR', 'BIKE', 'CAR', 'EV', 'CAR'];
  for (let day = 13; day >= 1; day--) {
    const bookingsThatDay = 1 + (day % 3);
    for (let n = 0; n < bookingsThatDay; n++) {
      const k = day + n;
      await book({
        person: k % people.length,
        area: areaNames[k % areaNames.length],
        type: types[k % types.length],
        slotIndex: n,
        start: atHour(-day, 9 + ((k * 3) % 9)),
        hours: 1 + (k % 3),
        status: day === 6 && n === 0 ? 'CANCELLED' : 'COMPLETED',
        refundPercent: 100,
      });
    }
  }
  // Live data for the demo.
  const active = await book({ person: 1, area: 'HITEC City Parking', type: 'CAR', slotIndex: 0, start: new Date(now - 40 * 60_000), hours: 2, status: 'ACTIVE' });
  const upcoming = await book({ person: 0, area: 'Hyderabad Central Parking', type: 'CAR', slotIndex: 1, start: atHour(1, 10), hours: 2, status: 'CONFIRMED' });
  await book({ person: 2, area: 'HITEC City Parking', type: 'EV', slotIndex: 0, start: atHour(1, 15), hours: 3, status: 'CONFIRMED' });
  await book({ person: 3, area: 'Madhapur Smart Parking', type: 'BIKE', slotIndex: 0, start: atHour(2, 18), hours: 1.5, status: 'CONFIRMED' });

  // ---- Notifications ------------------------------------------------------
  await db.insert(notifications).values([
    { userId: people[0].id, type: 'SYSTEM', title: 'Welcome to Smart Parking', message: 'Your account is ready. Find a parking area, pick a slot and reserve it in under a minute.', isRead: true, createdAt: new Date(now - 30 * DAY) },
    { userId: people[0].id, type: 'BOOKING_CONFIRMATION', title: 'Booking confirmed', message: `Your parking reservation at ${upcoming.area} has been confirmed. Slot ${upcoming.slot.slotNumber}. Booking ID ${upcoming.reservation.bookingRef}.`, reservationId: upcoming.reservation.id, createdAt: new Date(now - 6 * 60_000) },
    { userId: people[0].id, type: 'PAYMENT_SUCCESS', title: 'Payment successful', message: `Payment of ₹${upcoming.amount} was successful for booking ${upcoming.reservation.bookingRef}.`, reservationId: upcoming.reservation.id, createdAt: new Date(now - 5 * 60_000) },
    { userId: people[1].id, type: 'BOOKING_CONFIRMATION', title: 'Booking confirmed', message: `Your parking reservation at ${active.area} has been confirmed. Slot ${active.slot.slotNumber}.`, reservationId: active.reservation.id, isRead: true, createdAt: new Date(now - 4 * HOUR) },
    { userId: people[2].id, type: 'SYSTEM', title: 'New EV chargers at HITEC City', message: 'Six fast-charging bays are now available at HITEC City Parking.', createdAt: new Date(now - 2 * DAY) },
  ]);

  await syncSlotStatuses(db, { notify: false });

  const [{ n }] = (await db.execute<{ n: string }>(sql`SELECT count(*) AS n FROM ${reservations}`)).rows;
  console.log(`Seeded 1 admin, ${people.length} users, ${AREAS.length} parking areas, ${[...slotsByArea.values()].flat().length} slots, ${n} reservations.`);
  console.log('\nDemo accounts (development only):');
  console.log(`  Admin: ${DEMO.admin.email} / ${DEMO.admin.password}`);
  console.log(`  User:  ${DEMO.user.email} / ${DEMO.user.password}`);
}

seed()
  .then(() => pool.end())
  .catch((err) => {
    console.error('Seeding failed:', err);
    process.exit(1);
  });
