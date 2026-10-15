import { http } from './client';
import type {
  AdminDashboard,
  AdminUser,
  AppConfig,
  AppNotification,
  Occupancy,
  OperatingHour,
  Paged,
  ParkingArea,
  Payment,
  PaymentOrder,
  Quote,
  Rate,
  Reservation,
  RevenueReport,
  Slot,
  SlotStatus,
  User,
  UserDashboard,
  Vehicle,
  VehicleType,
} from '../types';

const data = <T>(p: Promise<{ data: T }>) => p.then((r) => r.data);
/** Drops empty values so they are not sent as "?q=&status=". */
const clean = (params: object) => Object.fromEntries(Object.entries(params).filter(([, v]) => v !== '' && v !== undefined && v !== null && v !== false));

export interface Session {
  token: string;
  user: User;
}
export interface AreaFilters {
  q?: string;
  vehicleType?: VehicleType | '';
  maxPrice?: number | '';
  availableOnly?: boolean;
  evOnly?: boolean;
  includeInactive?: boolean;
  sort?: 'price_asc' | 'price_desc' | 'distance' | 'availability' | 'name';
  lat?: number;
  lng?: number;
}
export interface AreaInput {
  name: string;
  description: string;
  address: string;
  city: string;
  latitude: number;
  longitude: number;
  is24x7: boolean;
  status?: 'ACTIVE' | 'INACTIVE';
  rates?: Rate[];
  operatingHours?: OperatingHour[];
}
export interface SlotInput {
  slotNumber: string;
  floor: string;
  vehicleType: VehicleType;
  price?: number | null;
  isEv: boolean;
}
export interface BookingInput {
  slotId: string;
  vehicleId?: string;
  startTime: string;
  endTime: string;
}
export interface VerifyInput {
  reservationId: string;
  razorpayOrderId?: string;
  razorpayPaymentId?: string;
  razorpaySignature?: string;
  mockOutcome?: 'success' | 'failure';
  failureReason?: string;
}
export type BookingTab = 'upcoming' | 'active' | 'completed' | 'cancelled';
export interface ReservationList extends Paged<Reservation> {
  counts: Record<BookingTab, number>;
}

export const api = {
  config: () => data<AppConfig>(http.get('/config')),

  // Auth & account
  register: (body: { name: string; email: string; password: string; phone?: string }) => data<Session>(http.post('/auth/register', body)),
  login: (body: { email: string; password: string }) => data<Session>(http.post('/auth/login', body)),
  logout: () => http.post('/auth/logout').catch(() => undefined),
  me: () => data<{ user: User }>(http.get('/auth/me')).then((r) => r.user),
  updateProfile: (body: { name: string; phone?: string | null }) => data<{ user: User }>(http.put('/auth/profile', body)).then((r) => r.user),
  changePassword: (body: { currentPassword: string; newPassword: string }) => data<{ message: string }>(http.put('/auth/password', body)),
  vehicles: () => data<Vehicle[]>(http.get('/vehicles')),
  addVehicle: (body: { vehicleNumber: string; vehicleType: VehicleType }) => data<Vehicle>(http.post('/vehicles', body)),
  removeVehicle: (id: string) => http.delete(`/vehicles/${id}`),
  dashboard: () => data<UserDashboard>(http.get('/dashboard')),

  // Parking
  areas: (filters: AreaFilters = {}) => data<ParkingArea[]>(http.get('/parking', { params: clean(filters) })),
  area: (id: string, coords?: { lat: number; lng: number }) => data<ParkingArea>(http.get(`/parking/${id}`, { params: coords })),
  createArea: (body: AreaInput) => data<ParkingArea>(http.post('/parking', body)),
  updateArea: (id: string, body: Partial<AreaInput>) => data<ParkingArea>(http.put(`/parking/${id}`, body)),
  deactivateArea: (id: string) => data<ParkingArea>(http.delete(`/parking/${id}`)),
  setRates: (id: string, rates: Rate[]) => data<ParkingArea>(http.put(`/parking/${id}/rates`, { rates })),
  setHours: (id: string, body: { is24x7: boolean; operatingHours: OperatingHour[] }) => data<ParkingArea>(http.put(`/parking/${id}/hours`, body)),

  // Slots
  slots: (areaId: string, params: { start?: string; end?: string; vehicleType?: VehicleType | '' } = {}) =>
    data<Slot[]>(http.get(`/parking/${areaId}/slots`, { params: clean(params) })),
  createSlot: (areaId: string, body: SlotInput) => data<Slot>(http.post(`/parking/${areaId}/slots`, body)),
  updateSlot: (id: string, body: Partial<SlotInput>) => data<Slot>(http.put(`/slots/${id}`, body)),
  setSlotStatus: (id: string, status: Exclude<SlotStatus, 'RESERVED'>) => data<Slot>(http.patch(`/slots/${id}/status`, { status })),
  deleteSlot: (id: string) => http.delete(`/slots/${id}`),

  // Reservations & payments
  quote: (body: BookingInput) => data<Quote>(http.post('/reservations/quote', body)),
  createReservation: (body: BookingInput) => data<Reservation>(http.post('/reservations', body)),
  reservations: (params: { tab?: BookingTab | 'all'; page?: number; pageSize?: number }) => data<ReservationList>(http.get('/reservations', { params })),
  reservation: (id: string) => data<Reservation>(http.get(`/reservations/${id}`)),
  cancelReservation: (id: string, reason?: string) => data<Reservation>(http.patch(`/reservations/${id}/cancel`, { reason })),
  createOrder: (reservationId: string) => data<PaymentOrder>(http.post('/payments/create-order', { reservationId })),
  verifyPayment: (body: VerifyInput) => data<Reservation>(http.post('/payments/verify', body)),

  // Notifications
  notifications: () => data<{ items: AppNotification[]; unread: number }>(http.get('/notifications')),
  markRead: (id: string) => data<AppNotification>(http.patch(`/notifications/${id}/read`)),
  markAllRead: () => data<{ updated: number }>(http.patch('/notifications/read-all')),

  // Admin
  admin: {
    dashboard: () => data<AdminDashboard>(http.get('/admin/dashboard')),
    occupancy: () => data<Occupancy>(http.get('/admin/occupancy')),
    revenue: (days: number) => data<RevenueReport>(http.get('/admin/revenue', { params: { days } })),
    users: (params: { q?: string; page?: number; pageSize?: number }) => data<Paged<AdminUser>>(http.get('/admin/users', { params: clean(params) })),
    user: (id: string) => data<AdminUser>(http.get(`/admin/users/${id}`)),
    setUserStatus: (id: string, status: 'ACTIVE' | 'INACTIVE') => data<AdminUser>(http.patch(`/admin/users/${id}/status`, { status })),
    reservations: (params: { status?: string; areaId?: string; q?: string; page?: number; pageSize?: number }) =>
      data<Paged<Reservation>>(http.get('/admin/reservations', { params: clean(params) })),
    cancelReservation: (id: string, reason?: string) => data<Reservation>(http.patch(`/admin/reservations/${id}/cancel`, { reason })),
    payments: (params: { status?: string; q?: string; page?: number; pageSize?: number }) => data<Paged<Payment>>(http.get('/admin/payments', { params: clean(params) })),
    slots: (areaId?: string) => data<Slot[]>(http.get('/admin/slots', { params: clean({ areaId }) })),
    notifications: () => data<AppNotification[]>(http.get('/admin/notifications')),
    broadcast: (body: { title: string; message: string; userId?: string }) => data<{ sent: number }>(http.post('/admin/notifications', body)),
  },
};
