import { BadgeCheck, Ban, BellRing, Megaphone, Wallet, type LucideIcon } from 'lucide-react';
import type { NotificationType } from '../types';

const META: Record<NotificationType, { icon: LucideIcon; tone: string }> = {
  BOOKING_CONFIRMATION: { icon: BadgeCheck, tone: 'bg-emerald-100 text-emerald-700' },
  PAYMENT_SUCCESS: { icon: Wallet, tone: 'bg-brand-100 text-brand-700' },
  BOOKING_REMINDER: { icon: BellRing, tone: 'bg-amber-100 text-amber-700' },
  BOOKING_CANCELLED: { icon: Ban, tone: 'bg-red-100 text-red-700' },
  SYSTEM: { icon: Megaphone, tone: 'bg-slate-100 text-slate-600' },
};
export const notificationIcon = (type: NotificationType) => META[type];
