import { relations } from 'drizzle-orm';
import {
  boolean,
  doublePrecision,
  index,
  integer,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';

export const userRole = pgEnum('user_role', ['USER', 'ADMIN']);
export const accountStatus = pgEnum('account_status', ['ACTIVE', 'INACTIVE']);
export const slotStatus = pgEnum('slot_status', ['AVAILABLE', 'RESERVED', 'OCCUPIED', 'MAINTENANCE']);
export const reservationStatus = pgEnum('reservation_status', [
  'PENDING',
  'CONFIRMED',
  'ACTIVE',
  'COMPLETED',
  'CANCELLED',
  'EXPIRED',
]);
export const paymentStatus = pgEnum('payment_status', ['PENDING', 'SUCCESS', 'FAILED', 'REFUNDED']);
export const vehicleType = pgEnum('vehicle_type', ['BIKE', 'CAR', 'EV']);
export const notificationType = pgEnum('notification_type', [
  'BOOKING_CONFIRMATION',
  'PAYMENT_SUCCESS',
  'BOOKING_REMINDER',
  'BOOKING_CANCELLED',
  'SYSTEM',
]);

const id = () => uuid('id').primaryKey().defaultRandom();
const createdAt = () => timestamp('created_at', { withTimezone: true }).notNull().defaultNow();
const updatedAt = () =>
  timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date());
const money = (name: string) => numeric(name, { precision: 10, scale: 2 });

export const users = pgTable('users', {
  id: id(),
  name: varchar('name', { length: 100 }).notNull(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  phone: varchar('phone', { length: 20 }),
  role: userRole('role').notNull().default('USER'),
  status: accountStatus('status').notNull().default('ACTIVE'),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const vehicles = pgTable(
  'vehicles',
  {
    id: id(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    vehicleNumber: varchar('vehicle_number', { length: 20 }).notNull(),
    vehicleType: vehicleType('vehicle_type').notNull(),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex('vehicles_user_number_uq').on(t.userId, t.vehicleNumber)],
);

export const parkingAreas = pgTable(
  'parking_areas',
  {
    id: id(),
    name: varchar('name', { length: 120 }).notNull(),
    description: text('description').notNull().default(''),
    address: varchar('address', { length: 255 }).notNull(),
    city: varchar('city', { length: 80 }).notNull(),
    latitude: doublePrecision('latitude').notNull(),
    longitude: doublePrecision('longitude').notNull(),
    is24x7: boolean('is_24x7').notNull().default(false),
    status: accountStatus('status').notNull().default('ACTIVE'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index('parking_areas_city_idx').on(t.city), index('parking_areas_status_idx').on(t.status)],
);

/** Hourly rate per vehicle type for an area. A slot may override it with its own price. */
export const parkingRates = pgTable(
  'parking_rates',
  {
    id: id(),
    parkingAreaId: uuid('parking_area_id')
      .notNull()
      .references(() => parkingAreas.id, { onDelete: 'cascade' }),
    vehicleType: vehicleType('vehicle_type').notNull(),
    hourlyRate: money('hourly_rate').notNull(),
  },
  (t) => [uniqueIndex('parking_rates_area_type_uq').on(t.parkingAreaId, t.vehicleType)],
);

/** dayOfWeek: 0 = Sunday … 6 = Saturday. Times are "HH:MM" in APP_TIMEZONE. */
export const operatingHours = pgTable(
  'operating_hours',
  {
    id: id(),
    parkingAreaId: uuid('parking_area_id')
      .notNull()
      .references(() => parkingAreas.id, { onDelete: 'cascade' }),
    dayOfWeek: integer('day_of_week').notNull(),
    openTime: varchar('open_time', { length: 5 }).notNull().default('06:00'),
    closeTime: varchar('close_time', { length: 5 }).notNull().default('23:00'),
    isClosed: boolean('is_closed').notNull().default(false),
  },
  (t) => [uniqueIndex('operating_hours_area_day_uq').on(t.parkingAreaId, t.dayOfWeek)],
);

export const parkingSlots = pgTable(
  'parking_slots',
  {
    id: id(),
    parkingAreaId: uuid('parking_area_id')
      .notNull()
      .references(() => parkingAreas.id, { onDelete: 'cascade' }),
    slotNumber: varchar('slot_number', { length: 20 }).notNull(),
    floor: varchar('floor', { length: 20 }).notNull().default('G'),
    vehicleType: vehicleType('vehicle_type').notNull(),
    status: slotStatus('status').notNull().default('AVAILABLE'),
    /** Optional per-slot hourly price; null means "use the area rate". */
    price: money('price'),
    isEv: boolean('is_ev').notNull().default(false),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex('parking_slots_area_number_uq').on(t.parkingAreaId, t.slotNumber),
    index('parking_slots_status_idx').on(t.status),
  ],
);

export const reservations = pgTable(
  'reservations',
  {
    id: id(),
    bookingRef: varchar('booking_ref', { length: 16 }).notNull().unique(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    parkingSlotId: uuid('parking_slot_id')
      .notNull()
      .references(() => parkingSlots.id, { onDelete: 'restrict' }),
    vehicleId: uuid('vehicle_id').references(() => vehicles.id, { onDelete: 'set null' }),
    vehicleNumber: varchar('vehicle_number', { length: 20 }),
    startTime: timestamp('start_time', { withTimezone: true }).notNull(),
    endTime: timestamp('end_time', { withTimezone: true }).notNull(),
    billedHours: numeric('billed_hours', { precision: 6, scale: 2 }).notNull(),
    hourlyRate: money('hourly_rate').notNull(),
    baseAmount: money('base_amount').notNull(),
    taxAmount: money('tax_amount').notNull(),
    amount: money('amount').notNull(),
    status: reservationStatus('status').notNull().default('PENDING'),
    reminderSent: boolean('reminder_sent').notNull().default(false),
    cancelledAt: timestamp('cancelled_at', { withTimezone: true }),
    cancelReason: varchar('cancel_reason', { length: 255 }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index('reservations_slot_time_idx').on(t.parkingSlotId, t.startTime, t.endTime),
    index('reservations_user_idx').on(t.userId),
    index('reservations_status_idx').on(t.status),
  ],
);

export const payments = pgTable(
  'payments',
  {
    id: id(),
    reservationId: uuid('reservation_id')
      .notNull()
      .unique()
      .references(() => reservations.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    amount: money('amount').notNull(),
    currency: varchar('currency', { length: 3 }).notNull().default('INR'),
    status: paymentStatus('status').notNull().default('PENDING'),
    /** RAZORPAY = Razorpay test mode, MOCK = built-in simulated gateway */
    provider: varchar('provider', { length: 10 }).notNull().default('MOCK'),
    razorpayOrderId: varchar('razorpay_order_id', { length: 64 }),
    razorpayPaymentId: varchar('razorpay_payment_id', { length: 64 }),
    refundAmount: money('refund_amount'),
    failureReason: varchar('failure_reason', { length: 255 }),
    paidAt: timestamp('paid_at', { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index('payments_user_idx').on(t.userId), index('payments_status_idx').on(t.status)],
);

export const notifications = pgTable(
  'notifications',
  {
    id: id(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    type: notificationType('type').notNull(),
    title: varchar('title', { length: 120 }).notNull(),
    message: text('message').notNull(),
    isRead: boolean('is_read').notNull().default(false),
    reservationId: uuid('reservation_id').references(() => reservations.id, { onDelete: 'set null' }),
    createdAt: createdAt(),
  },
  (t) => [index('notifications_user_read_idx').on(t.userId, t.isRead)],
);

export const usersRelations = relations(users, ({ many }) => ({
  vehicles: many(vehicles),
  reservations: many(reservations),
  notifications: many(notifications),
  payments: many(payments),
}));
export const vehiclesRelations = relations(vehicles, ({ one }) => ({
  user: one(users, { fields: [vehicles.userId], references: [users.id] }),
}));
export const parkingAreasRelations = relations(parkingAreas, ({ many }) => ({
  slots: many(parkingSlots),
  rates: many(parkingRates),
  operatingHours: many(operatingHours),
}));
export const parkingRatesRelations = relations(parkingRates, ({ one }) => ({
  area: one(parkingAreas, { fields: [parkingRates.parkingAreaId], references: [parkingAreas.id] }),
}));
export const operatingHoursRelations = relations(operatingHours, ({ one }) => ({
  area: one(parkingAreas, { fields: [operatingHours.parkingAreaId], references: [parkingAreas.id] }),
}));
export const parkingSlotsRelations = relations(parkingSlots, ({ one, many }) => ({
  area: one(parkingAreas, { fields: [parkingSlots.parkingAreaId], references: [parkingAreas.id] }),
  reservations: many(reservations),
}));
export const reservationsRelations = relations(reservations, ({ one }) => ({
  user: one(users, { fields: [reservations.userId], references: [users.id] }),
  slot: one(parkingSlots, { fields: [reservations.parkingSlotId], references: [parkingSlots.id] }),
  vehicle: one(vehicles, { fields: [reservations.vehicleId], references: [vehicles.id] }),
  payment: one(payments, { fields: [reservations.id], references: [payments.reservationId] }),
}));
export const paymentsRelations = relations(payments, ({ one }) => ({
  reservation: one(reservations, { fields: [payments.reservationId], references: [reservations.id] }),
  user: one(users, { fields: [payments.userId], references: [users.id] }),
}));
export const notificationsRelations = relations(notifications, ({ one }) => ({
  user: one(users, { fields: [notifications.userId], references: [users.id] }),
}));

export type User = typeof users.$inferSelect;
export type ParkingArea = typeof parkingAreas.$inferSelect;
export type ParkingSlot = typeof parkingSlots.$inferSelect;
export type Reservation = typeof reservations.$inferSelect;
export type Payment = typeof payments.$inferSelect;
export type VehicleType = (typeof vehicleType.enumValues)[number];
export type SlotStatus = (typeof slotStatus.enumValues)[number];
export type ReservationStatus = (typeof reservationStatus.enumValues)[number];
