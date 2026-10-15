import { useQuery } from '@tanstack/react-query';
import { Ban, CreditCard, Navigation, Printer } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { api } from '../api';
import { Logo } from '../components/Logo';
import { Alert, Button, ButtonLink, Card, ErrorState, PageHeader, Skeleton, StatusBadge } from '../components/ui';
import { CancelBookingDialog } from '../features/booking/CancelBookingDialog';
import { PriceBreakdown } from '../features/booking/PriceBreakdown';
import { useConfig } from '../hooks/useConfig';
import { formatDate, formatDateTime, formatDuration, formatTime, money, vehicleLabel } from '../utils/format';

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="flex justify-between gap-4 py-2"><dt className="text-slate-500">{label}</dt><dd className="text-right font-medium text-ink-900">{children}</dd></div>;
}

export function BookingDetails() {
  const { id = '' } = useParams();
  const [params] = useSearchParams();
  const { data: config } = useConfig();
  const [cancelling, setCancelling] = useState(false);
  const { data: b, error, refetch } = useQuery({ queryKey: ['reservation', id], queryFn: () => api.reservation(id) });

  // "View receipt" from the bookings list jumps straight to the receipt section.
  useEffect(() => {
    if (b && params.get('receipt')) document.getElementById('receipt')?.scrollIntoView({ behavior: 'smooth' });
  }, [b, params]);

  if (error) return <ErrorState message={error.message} onRetry={() => refetch()} />;
  if (!b) return <div className="space-y-4"><Skeleton className="h-10 w-64" /><Skeleton className="h-96 w-full" /></div>;

  const hours = (new Date(b.endTime).getTime() - new Date(b.startTime).getTime()) / 3_600_000;
  const paid = b.payment?.status === 'SUCCESS' || b.payment?.status === 'REFUNDED';
  const live = b.status === 'CONFIRMED' || b.status === 'ACTIVE';
  // The QR carries only the booking reference; a gate scanner would look the booking up on the server.
  const qrValue = `SMARTPARKING:${b.bookingRef}`;

  return (
    <>
      <div className="no-print">
        <PageHeader
          back="/bookings"
          title={`Booking ${b.bookingRef}`}
          subtitle={`Booked on ${formatDateTime(b.createdAt)}`}
          action={
            <>
              {b.status === 'PENDING' && <ButtonLink to={`/booking/${b.slot.id}?reservation=${b.id}`} icon={CreditCard}>Pay now</ButtonLink>}
              {paid && <Button variant="secondary" icon={Printer} onClick={() => window.print()}>Print / download receipt</Button>}
              {b.cancellation.allowed && <Button variant="secondary" icon={Ban} className="!text-red-600" onClick={() => setCancelling(true)}>Cancel booking</Button>}
            </>
          }
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <Card id="receipt" className="overflow-hidden print:border-0 print:shadow-none">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 bg-slate-50 px-5 py-4 sm:px-6">
            <div className="hidden print:block"><Logo /></div>
            <div>
              <p className="text-xs font-semibold tracking-widest text-slate-500 uppercase">{paid ? 'Booking receipt' : 'Booking summary'}</p>
              <p className="font-display text-xl font-bold text-ink-900">{b.area.name}</p>
              <p className="text-sm text-slate-500">{b.area.address}</p>
            </div>
            <div className="flex gap-2"><StatusBadge status={b.status} />{b.payment && <StatusBadge status={b.payment.status} kind="payment" />}</div>
          </div>

          <div className="grid gap-x-10 gap-y-6 p-5 sm:p-6 md:grid-cols-2">
            <section>
              <h2 className="mb-1 text-sm font-semibold tracking-wide text-slate-500 uppercase">Reservation</h2>
              <dl className="divide-y divide-slate-100 text-sm">
                <Row label="Booking ID"><span className="font-mono">{b.bookingRef}</span></Row>
                <Row label="Parking area">{b.area.name}</Row>
                <Row label="Slot"><span className="font-mono">{b.slot.slotNumber}</span> · Level {b.slot.floor}</Row>
                <Row label="Vehicle">{b.vehicleNumber ? <span className="font-mono">{b.vehicleNumber}</span> : vehicleLabel[b.slot.vehicleType]}{b.slot.isEv ? ' · EV bay' : ''}</Row>
                <Row label="Date">{formatDate(b.startTime)}</Row>
                <Row label="Start time">{formatTime(b.startTime)}</Row>
                <Row label="End time">{formatTime(b.endTime)}{formatDate(b.endTime) !== formatDate(b.startTime) ? ` (${formatDate(b.endTime)})` : ''}</Row>
                <Row label="Duration">{formatDuration(hours)}</Row>
                <Row label="Booked by">{b.user.name}</Row>
              </dl>
            </section>
            <section>
              <h2 className="mb-3 text-sm font-semibold tracking-wide text-slate-500 uppercase">Payment</h2>
              <PriceBreakdown hourlyRate={b.hourlyRate} billedHours={b.billedHours} baseAmount={b.baseAmount} taxAmount={b.taxAmount} total={b.amount} taxPercent={config?.taxPercent} />
              {b.payment ? (
                <dl className="mt-4 divide-y divide-slate-100 border-t border-slate-100 text-sm">
                  <Row label="Payment status"><StatusBadge status={b.payment.status} kind="payment" /></Row>
                  {b.payment.paidAt && <Row label="Paid on">{formatDateTime(b.payment.paidAt)}</Row>}
                  {b.payment.razorpayPaymentId && <Row label="Payment ID"><span className="font-mono text-xs break-all">{b.payment.razorpayPaymentId}</span></Row>}
                  {b.payment.razorpayOrderId && <Row label="Order ID"><span className="font-mono text-xs break-all">{b.payment.razorpayOrderId}</span></Row>}
                  <Row label="Gateway">{b.payment.provider === 'RAZORPAY' ? 'Razorpay (test mode)' : 'Simulated gateway'}</Row>
                  {b.payment.refundAmount !== null && <Row label="Refunded"><span className="text-violet-700">{money(b.payment.refundAmount)}</span></Row>}
                </dl>
              ) : <p className="mt-4 text-sm text-slate-500">No payment has been made yet.</p>}
            </section>
          </div>
          {b.status === 'CANCELLED' && <div className="px-5 pb-5 sm:px-6"><Alert tone="red">Cancelled on {b.cancelledAt ? formatDateTime(b.cancelledAt) : '—'}. {b.cancelReason}</Alert></div>}
          {b.status === 'EXPIRED' && <div className="px-5 pb-5 sm:px-6"><Alert tone="amber">This booking expired because it was not paid for in time. The bay was released.</Alert></div>}
          <p className="hidden border-t border-slate-200 px-6 py-3 text-xs text-slate-500 print:block">Smart Parking Management System · test-mode payment, not a tax invoice · printed {formatDateTime(new Date())}</p>
        </Card>

        <aside className="space-y-4">
          <Card className="p-5 text-center">
            <p className="text-xs font-semibold tracking-widest text-slate-500 uppercase">Booking reference</p>
            <div data-testid="booking-qr" className={`mx-auto mt-3 w-fit rounded-xl border border-slate-200 bg-white p-3 ${live ? '' : 'opacity-30 grayscale'}`}>
              <QRCodeSVG value={qrValue} size={148} level="M" marginSize={0} title={`QR code for booking ${b.bookingRef}`} />
            </div>
            <p className="mt-3 font-mono text-lg font-bold text-ink-900">{b.bookingRef}</p>
            <p className="mt-1 text-xs text-slate-500">{live ? 'Show this at the entry gate.' : `Not valid for entry: booking is ${b.status.toLowerCase()}.`}</p>
          </Card>
          <div className="no-print space-y-4">
            <ButtonLink variant="secondary" className="w-full" icon={Navigation} to={`https://www.openstreetmap.org/directions?to=${b.area.latitude},${b.area.longitude}`} target="_blank" rel="noreferrer">Get directions</ButtonLink>
            {live && <Alert><b>Cancellation.</b> {b.cancellation.note}</Alert>}
          </div>
        </aside>
      </div>
      <CancelBookingDialog booking={cancelling ? b : null} onClose={() => setCancelling(false)} />
    </>
  );
}
