import { z } from 'zod';

export const vehicleTypeEnum = z.enum(['BIKE', 'CAR', 'EV']);
export const slotStatusEnum = z.enum(['AVAILABLE', 'RESERVED', 'OCCUPIED', 'MAINTENANCE']);
export const reservationStatusEnum = z.enum(['PENDING', 'CONFIRMED', 'ACTIVE', 'COMPLETED', 'CANCELLED', 'EXPIRED']);
export const paymentStatusEnum = z.enum(['PENDING', 'SUCCESS', 'FAILED', 'REFUNDED']);
const hhmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Use 24-hour HH:MM');
const money = z.coerce.number().positive('Must be greater than 0').max(100000);
const phone = z
  .string()
  .trim()
  .regex(/^\+?[0-9 -]{7,15}$/, 'Enter a valid phone number');
const queryBool = z
  .enum(['true', 'false', '1', '0'])
  .transform((v) => v === 'true' || v === '1')
  .optional();

export const idParam = z.object({ id: z.uuid('Invalid identifier') });
export const pageQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

// ---- Auth -----------------------------------------------------------------
const password = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(72, 'Password is too long')
  .regex(/[A-Za-z]/, 'Password must contain a letter')
  .regex(/\d/, 'Password must contain a number');

export const registerSchema = z.object({
  name: z.string().trim().min(2, 'Name is too short').max(100),
  email: z.email('Enter a valid email address').trim().toLowerCase(),
  password,
  phone: phone.optional().or(z.literal('').transform(() => undefined)),
});
export const loginSchema = z.object({
  email: z.email('Enter a valid email address').trim().toLowerCase(),
  password: z.string().min(1, 'Password is required'),
});
export const profileSchema = z.object({
  name: z.string().trim().min(2).max(100),
  phone: phone.nullable().optional().or(z.literal('').transform(() => null)),
});
export const passwordSchema = z.object({ currentPassword: z.string().min(1), newPassword: password });

export const vehicleSchema = z.object({
  vehicleNumber: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9 -]{4,15}$/, 'Enter a valid registration number'),
  vehicleType: vehicleTypeEnum,
});

// ---- Parking --------------------------------------------------------------
export const areaQuery = z.object({
  q: z.string().trim().max(100).optional(),
  vehicleType: vehicleTypeEnum.optional(),
  maxPrice: z.coerce.number().positive().optional(),
  availableOnly: queryBool,
  evOnly: queryBool,
  includeInactive: queryBool,
  sort: z.enum(['price_asc', 'price_desc', 'distance', 'availability', 'name']).default('name'),
  lat: z.coerce.number().min(-90).max(90).optional(),
  lng: z.coerce.number().min(-180).max(180).optional(),
});

const ratesSchema = z
  .array(z.object({ vehicleType: vehicleTypeEnum, hourlyRate: money }))
  .min(1, 'Set at least one rate')
  .refine((r) => new Set(r.map((x) => x.vehicleType)).size === r.length, 'Duplicate vehicle type in rates');
const hoursSchema = z
  .array(
    z
      .object({ dayOfWeek: z.number().int().min(0).max(6), openTime: hhmm, closeTime: hhmm, isClosed: z.boolean().default(false) })
      .refine((h) => h.isClosed || h.openTime < h.closeTime, 'Closing time must be after opening time'),
  )
  .length(7, 'Provide hours for all 7 days')
  .refine((h) => new Set(h.map((x) => x.dayOfWeek)).size === 7, 'Each day must appear once');

export const areaSchema = z.object({
  name: z.string().trim().min(3).max(120),
  description: z.string().trim().max(1000).default(''),
  address: z.string().trim().min(5).max(255),
  city: z.string().trim().min(2).max(80),
  latitude: z.coerce.number().min(-90).max(90),
  longitude: z.coerce.number().min(-180).max(180),
  is24x7: z.boolean().default(false),
  status: z.enum(['ACTIVE', 'INACTIVE']).default('ACTIVE'),
  rates: ratesSchema.optional(),
  operatingHours: hoursSchema.optional(),
});
export const areaUpdateSchema = areaSchema.partial();
export const ratesBody = z.object({ rates: ratesSchema });
export const hoursBody = z.object({ is24x7: z.boolean().optional(), operatingHours: hoursSchema });

const slotNumber = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z0-9-]{1,20}$/, 'Use letters, digits and dashes (e.g. A-101)');
export const slotSchema = z.object({
  slotNumber,
  floor: z.string().trim().min(1).max(20).default('G'),
  vehicleType: vehicleTypeEnum,
  price: money.nullable().optional(),
  isEv: z.boolean().default(false),
});
export const slotUpdateSchema = slotSchema.partial();
export const slotStatusSchema = z.object({ status: z.enum(['AVAILABLE', 'OCCUPIED', 'MAINTENANCE']) });
export const slotQuery = z.object({
  start: z.coerce.date().optional(),
  end: z.coerce.date().optional(),
  vehicleType: vehicleTypeEnum.optional(),
});

// ---- Reservations & payments ----------------------------------------------
export const reservationSchema = z.object({
  slotId: z.uuid(),
  vehicleId: z.uuid().optional(),
  startTime: z.coerce.date(),
  endTime: z.coerce.date(),
});
export const reservationQuery = pageQuery.extend({
  tab: z.enum(['upcoming', 'active', 'completed', 'cancelled', 'all']).default('all'),
});
export const cancelSchema = z.object({ reason: z.string().trim().max(255).optional() });

export const createOrderSchema = z.object({ reservationId: z.uuid() });
export const verifyPaymentSchema = z.object({
  reservationId: z.uuid(),
  razorpayOrderId: z.string().optional(),
  razorpayPaymentId: z.string().optional(),
  razorpaySignature: z.string().optional(),
  /** Simulated gateway only: the outcome chosen on the mock checkout screen. */
  mockOutcome: z.enum(['success', 'failure']).optional(),
  /** Real gateway: set when Razorpay reports a failed payment. */
  failureReason: z.string().max(255).optional(),
});

// ---- Admin ----------------------------------------------------------------
export const adminReservationQuery = pageQuery.extend({
  status: reservationStatusEnum.optional(),
  areaId: z.uuid().optional(),
  q: z.string().trim().max(100).optional(),
});
export const adminPaymentQuery = pageQuery.extend({ status: paymentStatusEnum.optional(), q: z.string().trim().max(100).optional() });
export const adminUserQuery = pageQuery.extend({ q: z.string().trim().max(100).optional() });
export const userStatusSchema = z.object({ status: z.enum(['ACTIVE', 'INACTIVE']) });
export const daysQuery = z.object({ days: z.coerce.number().int().min(1).max(365).default(14) });
export const broadcastSchema = z.object({
  title: z.string().trim().min(3).max(120),
  message: z.string().trim().min(3).max(1000),
  userId: z.uuid().optional(),
});
