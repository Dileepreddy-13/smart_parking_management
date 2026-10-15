export type Role = 'USER' | 'ADMIN';
export type AccountStatus = 'ACTIVE' | 'INACTIVE';
export type VehicleType = 'BIKE' | 'CAR' | 'EV';
export type SlotStatus = 'AVAILABLE' | 'RESERVED' | 'OCCUPIED' | 'MAINTENANCE';
export type ReservationStatus = 'PENDING' | 'CONFIRMED' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED' | 'EXPIRED';
export type PaymentStatus = 'PENDING' | 'SUCCESS' | 'FAILED' | 'REFUNDED';
export type NotificationType = 'BOOKING_CONFIRMATION' | 'PAYMENT_SUCCESS' | 'BOOKING_REMINDER' | 'BOOKING_CANCELLED' | 'SYSTEM';

export interface User {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  role: Role;
  status: AccountStatus;
  createdAt: string;
}

export interface Vehicle {
  id: string;
  vehicleNumber: string;
  vehicleType: VehicleType;
}

export interface Rate {
  vehicleType: VehicleType;
  hourlyRate: number;
}
export interface OperatingHour {
  dayOfWeek: number;
  openTime: string;
  closeTime: string;
  isClosed: boolean;
}
export type SlotCounts = Record<SlotStatus, number>;

export interface ParkingArea {
  id: string;
  name: string;
  description: string;
  address: string;
  city: string;
  latitude: number;
  longitude: number;
  is24x7: boolean;
  status: AccountStatus;
  createdAt: string;
  updatedAt: string;
  rates: Rate[];
  operatingHours: OperatingHour[];
  pricePerHour: number | null;
  totalSlots: number;
  availableSlots: number;
  counts: SlotCounts;
  occupancyPercent: number;
  vehicleTypes: VehicleType[];
  hasEvCharging: boolean;
  isOpenNow: boolean;
  todayHours: string;
  distanceKm: number | null;
}

export interface Slot {
  id: string;
  parkingAreaId: string;
  slotNumber: string;
  floor: string;
  vehicleType: VehicleType;
  status: SlotStatus;
  isEv: boolean;
  price: number | null;
  customPrice: number | null;
  bookable: boolean;
  unavailableReason: string | null;
  areaName?: string;
}

export interface PaymentSummary {
  id: string;
  status: PaymentStatus;
  amount: number;
  currency: string;
  provider: 'RAZORPAY' | 'MOCK';
  razorpayOrderId: string | null;
  razorpayPaymentId: string | null;
  refundAmount: number | null;
  paidAt: string | null;
}

export interface Reservation {
  id: string;
  bookingRef: string;
  status: ReservationStatus;
  startTime: string;
  endTime: string;
  billedHours: number;
  hourlyRate: number;
  baseAmount: number;
  taxAmount: number;
  amount: number;
  vehicleNumber: string | null;
  cancelledAt: string | null;
  cancelReason: string | null;
  createdAt: string;
  payBy: string | null;
  slot: Pick<Slot, 'id' | 'slotNumber' | 'floor' | 'vehicleType' | 'isEv'>;
  area: Pick<ParkingArea, 'id' | 'name' | 'address' | 'city' | 'latitude' | 'longitude'>;
  user: Pick<User, 'id' | 'name' | 'email' | 'phone'>;
  payment: PaymentSummary | null;
  cancellation: { allowed: boolean; refundPercent: number; note: string };
}

export interface Quote {
  billedHours: number;
  hourlyRate: number;
  baseAmount: number;
  taxPercent: number;
  taxAmount: number;
  totalAmount: number;
  currency: string;
  slot: Reservation['slot'];
  area: { id: string; name: string; address: string };
  startTime: string;
  endTime: string;
  policy: { freeCancelMinutes: number; lateRefundPercent: number; paymentHoldMinutes: number };
}

export interface PaymentOrder {
  paymentId: string;
  orderId: string;
  amount: number;
  amountInPaise: number;
  currency: string;
  provider: 'RAZORPAY' | 'MOCK';
  keyId: string | null;
  bookingRef: string;
}

export interface Payment extends PaymentSummary {
  failureReason: string | null;
  createdAt: string;
  reservation: { id: string; bookingRef: string; startTime: string; endTime: string; status: ReservationStatus };
  user: Pick<User, 'id' | 'name' | 'email'>;
}

export interface AppNotification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  isRead: boolean;
  reservationId: string | null;
  createdAt: string;
  user?: Pick<User, 'id' | 'name' | 'email'>;
}

export interface Paged<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface AppConfig {
  paymentProvider: 'RAZORPAY' | 'MOCK';
  emailEnabled: boolean;
  taxPercent: number;
  paymentHoldMinutes: number;
  freeCancelMinutes: number;
  lateCancelRefundPercent: number;
  timezone: string;
}

export interface UserDashboard {
  activeReservation: Reservation | null;
  upcomingReservation: Reservation | null;
  stats: { totalBookings: number; completedBookings: number; cancelledBookings: number; upcomingBookings: number; totalSpent: number };
  recentPayments: Payment[];
  notifications: { items: AppNotification[]; unread: number };
  bookingsByMonth: Array<{ month: string; bookings: number }>;
}

export interface AdminDashboard {
  stats: {
    totalParkingAreas: number;
    totalSlots: number;
    availableSlots: number;
    occupiedSlots: number;
    reservedSlots: number;
    maintenanceSlots: number;
    occupancyPercent: number;
    todaysReservations: number;
    todaysRevenue: number;
    totalRevenue: number;
    activeReservations: number;
    totalUsers: number;
  };
  charts: {
    occupancyByArea: Array<{ name: string; available: number; reserved: number; occupied: number; maintenance: number; occupancyPercent: number }>;
    overTime: Array<{ day: string; revenue: number; reservations: number }>;
    slotStatus: Array<{ status: SlotStatus; count: number }>;
  };
}

export interface OccupancyRow {
  id: string;
  name: string;
  city: string;
  status: AccountStatus;
  total: number;
  available: number;
  reserved: number;
  occupied: number;
  maintenance: number;
  occupancyPercent: number;
}
export interface Occupancy {
  areas: OccupancyRow[];
  totals: SlotCounts & { total: number; occupancyPercent: number };
}

export interface RevenueReport {
  days: number;
  from: string;
  totals: { gross: number; refunds: number; net: number; payments: number };
  overTime: Array<{ day: string; revenue: number; reservations: number }>;
  byArea: Array<{ name: string; revenue: number; bookings: number }>;
  byVehicleType: Array<{ vehicleType: VehicleType; revenue: number; bookings: number }>;
  reservationsByStatus: Array<{ status: ReservationStatus; count: number }>;
  peakHours: Array<{ hour: number; bookings: number }>;
}

export interface AdminUser extends User {
  bookings: number;
  vehicles?: Vehicle[];
  totalSpent?: number;
}
