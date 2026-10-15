import { Router } from 'express';
import * as admin from '../controllers/admin.controller';
import * as auth from '../controllers/auth.controller';
import * as notification from '../controllers/notification.controller';
import * as parking from '../controllers/parking.controller';
import * as reservation from '../controllers/reservation.controller';
import { authenticate, optionalAuth, requireAdmin } from '../middleware/auth';
import { authLimiter } from '../middleware/rateLimit';
import { provider } from '../services/payment.gateway';
import { asyncHandler as h } from '../utils/asyncHandler';
import { env, smtpEnabled } from '../config/env';

const router = Router();

router.get('/health', (_req, res) => res.json({ status: 'ok', time: new Date().toISOString() }));
/** Public, non-secret settings the frontend needs to render policies and the checkout. */
router.get('/config', (_req, res) =>
  res.json({
    paymentProvider: provider,
    emailEnabled: smtpEnabled,
    taxPercent: env.TAX_PERCENT,
    paymentHoldMinutes: env.PAYMENT_HOLD_MINUTES,
    freeCancelMinutes: env.FREE_CANCEL_MINUTES,
    lateCancelRefundPercent: env.LATE_CANCEL_REFUND_PERCENT,
    timezone: env.APP_TIMEZONE,
  }),
);

// ---- Auth & account -------------------------------------------------------
router.post('/auth/register', authLimiter, h(auth.register));
router.post('/auth/login', authLimiter, h(auth.login));
router.post('/auth/logout', authenticate, h(auth.logout));
router.get('/auth/me', authenticate, h(auth.me));
router.put('/auth/profile', authenticate, h(auth.updateProfile));
router.put('/auth/password', authenticate, authLimiter, h(auth.changePassword));
router.get('/vehicles', authenticate, h(auth.listVehicles));
router.post('/vehicles', authenticate, h(auth.addVehicle));
router.delete('/vehicles/:id', authenticate, h(auth.removeVehicle));
router.get('/dashboard', authenticate, h(auth.dashboard));

// ---- Parking areas (public read, admin write) -----------------------------
router.get('/parking', optionalAuth, h(parking.list));
router.get('/parking/:id', optionalAuth, h(parking.get));
router.post('/parking', requireAdmin, h(parking.create));
router.put('/parking/:id', requireAdmin, h(parking.update));
router.delete('/parking/:id', requireAdmin, h(parking.deactivate));
router.put('/parking/:id/rates', requireAdmin, h(parking.setRates));
router.put('/parking/:id/hours', requireAdmin, h(parking.setHours));

// ---- Slots ----------------------------------------------------------------
router.get('/parking/:id/slots', optionalAuth, h(parking.listSlots));
router.post('/parking/:id/slots', requireAdmin, h(parking.createSlot));
router.put('/slots/:id', requireAdmin, h(parking.updateSlot));
router.patch('/slots/:id/status', requireAdmin, h(parking.changeSlotStatus));
router.delete('/slots/:id', requireAdmin, h(parking.deleteSlot));

// ---- Reservations ---------------------------------------------------------
router.post('/reservations/quote', authenticate, h(reservation.quote));
router.post('/reservations', authenticate, h(reservation.create));
router.get('/reservations', authenticate, h(reservation.list));
router.get('/reservations/:id', authenticate, h(reservation.get));
router.patch('/reservations/:id/cancel', authenticate, h(reservation.cancel));

// ---- Payments -------------------------------------------------------------
router.post('/payments/create-order', authenticate, h(reservation.createOrder));
router.post('/payments/verify', authenticate, h(reservation.verifyPayment));
router.get('/payments', authenticate, h(reservation.listPayments));
router.get('/payments/:id', authenticate, h(reservation.getPayment));

// ---- Notifications --------------------------------------------------------
router.get('/notifications', authenticate, h(notification.list));
router.patch('/notifications/read-all', authenticate, h(notification.markAllRead));
router.patch('/notifications/:id/read', authenticate, h(notification.markRead));

// ---- Admin ----------------------------------------------------------------
router.use('/admin', requireAdmin);
router.get('/admin/dashboard', h(admin.dashboard));
router.get('/admin/occupancy', h(admin.getOccupancy));
router.get('/admin/revenue', h(admin.revenue));
router.get('/admin/users', h(admin.users));
router.get('/admin/users/:id', h(admin.user));
router.patch('/admin/users/:id/status', h(admin.setUserStatus));
router.get('/admin/reservations', h(admin.reservations));
router.patch('/admin/reservations/:id/cancel', h(admin.cancelReservation));
router.get('/admin/payments', h(admin.payments));
router.get('/admin/slots', h(admin.slots));
router.get('/admin/notifications', h(admin.notifications));
router.post('/admin/notifications', h(admin.broadcast));

export default router;
