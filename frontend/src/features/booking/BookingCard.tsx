import { CalendarDays, Clock, MapPin } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Card, StatusBadge } from '../../components/ui';
import type { Reservation } from '../../types';
import { formatShortDate, formatTime, money } from '../../utils/format';

export function BookingCard({ booking, actions, highlight }: { booking: Reservation; actions?: ReactNode; highlight?: string }) {
  return (
    <Card className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center">
      <div className="flex shrink-0 items-center gap-4 sm:w-28 sm:flex-col sm:items-start sm:gap-1">
        <div className="rounded-lg border-2 border-dashed border-slate-300 bg-slate-50 px-3 py-1.5 text-center">
          <p className="text-[10px] font-semibold tracking-widest text-slate-500 uppercase">Bay</p>
          <p className="font-mono text-lg leading-tight font-bold text-ink-900">{booking.slot.slotNumber}</p>
        </div>
        <p className="font-mono text-xs text-slate-500">{booking.bookingRef}</p>
      </div>
      <div className="min-w-0 flex-1">
        {highlight && <p className="mb-1 text-xs font-semibold tracking-widest text-brand-600 uppercase">{highlight}</p>}
        <Link to={`/bookings/${booking.id}`} className="font-display text-lg font-semibold text-ink-900 hover:text-brand-600">{booking.area.name}</Link>
        <p className="flex items-start gap-1 text-sm text-slate-500"><MapPin className="mt-0.5 size-3.5 shrink-0" aria-hidden /><span className="truncate">{booking.area.address}</span></p>
        <p className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-slate-700">
          <span className="inline-flex items-center gap-1.5"><CalendarDays className="size-4 text-slate-400" aria-hidden />{formatShortDate(booking.startTime)}</span>
          <span className="inline-flex items-center gap-1.5"><Clock className="size-4 text-slate-400" aria-hidden />{formatTime(booking.startTime)} – {formatTime(booking.endTime)}</span>
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <StatusBadge status={booking.status} />
          {booking.payment && <StatusBadge status={booking.payment.status} kind="payment" />}
        </div>
      </div>
      <div className="flex shrink-0 items-center justify-between gap-3 border-t border-slate-100 pt-3 sm:flex-col sm:items-end sm:border-0 sm:pt-0">
        <p className="font-display text-xl font-bold text-ink-900">{money(booking.amount)}</p>
        <div className="flex flex-wrap justify-end gap-2">{actions}</div>
      </div>
    </Card>
  );
}
