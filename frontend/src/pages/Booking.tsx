import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CalendarDays, Check, CircleCheckBig, Clock, CreditCard, MapPin, ShieldCheck, Timer } from 'lucide-react';
import { useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { api, type VerifyInput } from '../api';
import { Alert, Button, ButtonLink, Card, cx, ErrorState, PageHeader, Skeleton, StatusBadge } from '../components/ui';
import { MockCheckout } from '../features/booking/MockCheckout';
import { PriceBreakdown } from '../features/booking/PriceBreakdown';
import { useAuth } from '../contexts/AuthContext';
import { useConfig } from '../hooks/useConfig';
import { useCountdown } from '../hooks/useCountdown';
import { PaymentDismissed, payWithRazorpay } from '../services/payment';
import type { PaymentOrder, Reservation } from '../types';
import { formatDate, formatTime, money, vehicleLabel } from '../utils/format';

const STEPS = ['Review', 'Payment', 'Confirmed'];
function Stepper({ current }: { current: number }) {
  return (
    <ol className="mb-6 flex items-center gap-2" aria-label="Booking progress">
      {STEPS.map((label, i) => (
        <li key={label} className="flex flex-1 items-center gap-2" aria-current={i === current ? 'step' : undefined}>
          <span className={cx('grid size-7 shrink-0 place-items-center rounded-full text-xs font-bold', i < current ? 'bg-emerald-600 text-white' : i === current ? 'bg-brand-600 text-white' : 'bg-slate-200 text-slate-500')}>
            {i < current ? <Check className="size-4" /> : i + 1}
          </span>
          <span className={cx('text-sm font-semibold', i <= current ? 'text-ink-900' : 'text-slate-400')}>{label}</span>
          {i < STEPS.length - 1 && <span className={cx('h-0.5 flex-1 rounded', i < current ? 'bg-emerald-500' : 'bg-slate-200')} aria-hidden />}
        </li>
      ))}
    </ol>
  );
}

function Details({ areaName, address, slotNumber, floor, type, start, end, vehicleNumber }: { areaName: string; address: string; slotNumber: string; floor: string; type: string; start: string; end: string; vehicleNumber?: string | null }) {
  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold">{areaName}</h2>
          <p className="mt-1 flex items-start gap-1 text-sm text-slate-500"><MapPin className="mt-0.5 size-3.5 shrink-0" aria-hidden />{address}</p>
        </div>
        <div className="rounded-lg border-2 border-dashed border-brand-500 bg-brand-50 px-3 py-1.5 text-center">
          <p className="text-[10px] font-semibold tracking-widest text-brand-700 uppercase">Bay</p>
          <p className="font-mono text-xl leading-tight font-bold text-brand-700">{slotNumber}</p>
        </div>
      </div>
      <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
        <div className="rounded-lg bg-slate-50 p-3"><dt className="flex items-center gap-1 text-xs text-slate-500"><CalendarDays className="size-3.5" />Date</dt><dd className="mt-0.5 font-semibold text-ink-900">{formatDate(start)}</dd></div>
        <div className="rounded-lg bg-slate-50 p-3"><dt className="flex items-center gap-1 text-xs text-slate-500"><Clock className="size-3.5" />Start</dt><dd className="mt-0.5 font-semibold text-ink-900">{formatTime(start)}</dd></div>
        <div className="rounded-lg bg-slate-50 p-3"><dt className="flex items-center gap-1 text-xs text-slate-500"><Clock className="size-3.5" />End</dt><dd className="mt-0.5 font-semibold text-ink-900">{formatTime(end)}</dd></div>
        <div className="rounded-lg bg-slate-50 p-3"><dt className="text-xs text-slate-500">Bay type</dt><dd className="mt-0.5 font-semibold text-ink-900">{vehicleLabel[type]} · L{floor}</dd></div>
      </dl>
      {vehicleNumber && <p className="text-sm text-slate-600">Vehicle: <span className="font-mono font-semibold text-ink-900">{vehicleNumber}</span></p>}
    </div>
  );
}

/** Step 1: the server validates availability and prices the booking; the user confirms. */
function ReviewStep({ slotId, start, end, onCreated }: { slotId: string; start: string; end: string; onCreated: (r: Reservation) => void }) {
  const [vehicleId, setVehicleId] = useState('');
  const input = { slotId, startTime: start, endTime: end };
  const quote = useQuery({ queryKey: ['quote', input], queryFn: () => api.quote(input), retry: false, staleTime: 0 });
  const vehicles = useQuery({ queryKey: ['vehicles'], queryFn: api.vehicles });
  const create = useMutation({ mutationFn: () => api.createReservation({ ...input, vehicleId: vehicleId || undefined }), onSuccess: onCreated });

  if (quote.error) {
    return (
      <Card className="p-6">
        <ErrorState message={quote.error.message} />
        <div className="mt-4 text-center"><ButtonLink to="/parking" variant="secondary">Choose another slot</ButtonLink></div>
      </Card>
    );
  }
  if (!quote.data) return <Skeleton className="h-80 w-full" />;
  const q = quote.data;
  const fits = (vehicles.data ?? []).filter((v) => v.vehicleType === q.slot.vehicleType || (v.vehicleType === 'EV' && q.slot.vehicleType === 'CAR'));

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_21rem]">
      <Card className="space-y-5 p-5 sm:p-6">
        <Details areaName={q.area.name} address={q.area.address} slotNumber={q.slot.slotNumber} floor={q.slot.floor} type={q.slot.vehicleType} start={q.startTime} end={q.endTime} />
        <div>
          <label htmlFor="vehicle" className="field-label">Vehicle (optional)</label>
          <select id="vehicle" className="field" value={vehicleId} onChange={(e) => setVehicleId(e.target.value)}>
            <option value="">I'll decide later</option>
            {fits.map((v) => <option key={v.id} value={v.id}>{v.vehicleNumber} · {vehicleLabel[v.vehicleType]}</option>)}
          </select>
          <p className="mt-1 text-xs text-slate-500">{fits.length === 0 ? <>No matching vehicle saved. <Link to="/profile" className="font-semibold text-brand-600 hover:underline">Add one in your profile</Link>.</> : 'Shown on your booking so staff can recognise your vehicle.'}</p>
        </div>
        <Alert>
          <p className="flex items-start gap-2"><ShieldCheck className="mt-0.5 size-4 shrink-0" aria-hidden />
            <span><b>Cancellation policy.</b> Free cancellation up to {q.policy.freeCancelMinutes} minutes before the start time. After that, {q.policy.lateRefundPercent}% is refunded. No cancellation once parking has started.</span>
          </p>
        </Alert>
      </Card>
      <Card className="h-fit space-y-5 p-5 lg:sticky lg:top-20">
        <h2 className="text-base font-semibold">Price summary</h2>
        <PriceBreakdown hourlyRate={q.hourlyRate} billedHours={q.billedHours} baseAmount={q.baseAmount} taxAmount={q.taxAmount} total={q.totalAmount} taxPercent={q.taxPercent} />
        {create.error && <Alert tone="red">{create.error.message}</Alert>}
        <Button size="lg" className="w-full" loading={create.isPending} onClick={() => create.mutate()}>Confirm reservation</Button>
        <p className="text-center text-xs text-slate-500">The bay is held for {q.policy.paymentHoldMinutes} minutes while you pay.</p>
      </Card>
    </div>
  );
}

/** Step 2: pay for a PENDING reservation through Razorpay test mode or the simulated gateway. */
function PaymentStep({ reservation, onPaid }: { reservation: Reservation; onPaid: (r: Reservation) => void }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { data: config } = useConfig();
  const [mockOrder, setMockOrder] = useState<PaymentOrder | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const hold = useCountdown(reservation.payBy);
  const expired = hold.seconds === 0;

  const verify = useMutation({
    mutationFn: (input: VerifyInput) => api.verifyPayment(input),
    onSuccess: (r) => { setMockOrder(null); onPaid(r); },
    onError: (err) => { setMockOrder(null); setFailure(err.message); void queryClient.invalidateQueries({ queryKey: ['reservation', reservation.id] }); },
  });
  const start = useMutation({
    mutationFn: () => api.createOrder(reservation.id),
    onMutate: () => setFailure(null),
    onSuccess: async (order) => {
      if (order.provider === 'MOCK') return setMockOrder(order);
      try {
        verify.mutate(await payWithRazorpay(order, reservation.id, user));
      } catch (err) {
        if (!(err instanceof PaymentDismissed)) setFailure((err as Error).message);
      }
    },
    onError: (err) => setFailure(err.message),
  });
  const cancel = useMutation({
    mutationFn: () => api.cancelReservation(reservation.id),
    onSuccess: () => { void queryClient.invalidateQueries({ queryKey: ['reservation', reservation.id] }); },
  });

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_21rem]">
      <Card className="space-y-5 p-5 sm:p-6">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm text-slate-500">Booking ID <span className="font-mono font-semibold text-ink-900">{reservation.bookingRef}</span></p>
          <StatusBadge status={reservation.status} />
        </div>
        <Details areaName={reservation.area.name} address={reservation.area.address} slotNumber={reservation.slot.slotNumber} floor={reservation.slot.floor} type={reservation.slot.vehicleType} start={reservation.startTime} end={reservation.endTime} vehicleNumber={reservation.vehicleNumber} />
        {expired ? (
          <Alert tone="red">The payment window has closed and the bay was released. Please book again.</Alert>
        ) : (
          <div className="flex items-center gap-3 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900" role="timer">
            <Timer className="size-5 shrink-0" aria-hidden />
            <p>Your bay is held for <b className="font-mono text-base">{hold.label}</b>. Complete the payment to confirm it.</p>
          </div>
        )}
        {failure && <Alert tone="red"><b>Payment failed.</b> {failure}</Alert>}
      </Card>
      <Card className="h-fit space-y-5 p-5 lg:sticky lg:top-20">
        <h2 className="text-base font-semibold">Amount due</h2>
        <PriceBreakdown hourlyRate={reservation.hourlyRate} billedHours={reservation.billedHours} baseAmount={reservation.baseAmount} taxAmount={reservation.taxAmount} total={reservation.amount} taxPercent={config?.taxPercent} />
        {expired ? (
          <ButtonLink to={`/parking/${reservation.area.id}`} size="lg" className="w-full">Book again</ButtonLink>
        ) : (
          <>
            <Button size="lg" className="w-full" icon={CreditCard} loading={start.isPending || (verify.isPending && !mockOrder)} onClick={() => start.mutate()}>
              {failure ? 'Retry payment' : `Pay ${money(reservation.amount)}`}
            </Button>
            <Button variant="ghost" className="w-full" loading={cancel.isPending} onClick={() => cancel.mutate()}>Cancel booking</Button>
          </>
        )}
        <p className="text-center text-xs text-slate-500">{config?.paymentProvider === 'RAZORPAY' ? 'Secured by Razorpay · TEST MODE, no real money.' : 'Simulated payment gateway · no real money.'}</p>
      </Card>
      <MockCheckout order={mockOrder} busy={verify.isPending} onClose={() => setMockOrder(null)} onResult={(mockOutcome) => verify.mutate({ reservationId: reservation.id, mockOutcome })} />
    </div>
  );
}

function SuccessStep({ reservation }: { reservation: Reservation }) {
  return (
    <Card className="mx-auto max-w-xl animate-rise overflow-hidden text-center">
      <div className="bg-emerald-600 px-6 py-8 text-white">
        <CircleCheckBig className="mx-auto size-14" aria-hidden />
        <h2 className="mt-3 text-2xl font-bold !text-white">Booking confirmed</h2>
        <p className="mt-1 text-emerald-50">Payment of {money(reservation.amount)} received.</p>
      </div>
      <div className="space-y-5 p-6">
        <div>
          <p className="text-xs font-semibold tracking-widest text-slate-500 uppercase">Booking ID</p>
          <p className="font-mono text-2xl font-bold text-ink-900" data-testid="booking-ref">{reservation.bookingRef}</p>
        </div>
        <p className="text-sm text-slate-600">
          <b className="text-ink-900">{reservation.area.name}</b> · Bay <span className="font-mono font-semibold">{reservation.slot.slotNumber}</span><br />
          {formatDate(reservation.startTime)}, {formatTime(reservation.startTime)} – {formatTime(reservation.endTime)}
        </p>
        <p className="text-xs text-slate-500">A confirmation is in your notifications. You'll get a reminder 30 minutes before the start time.</p>
        <div className="flex flex-wrap justify-center gap-3">
          <ButtonLink to={`/bookings/${reservation.id}`}>View booking & receipt</ButtonLink>
          <ButtonLink to="/dashboard" variant="secondary">Go to dashboard</ButtonLink>
        </div>
      </div>
    </Card>
  );
}

export function Booking() {
  const { id: slotId = '' } = useParams();
  const [params, setParams] = useSearchParams();
  const queryClient = useQueryClient();
  const reservationId = params.get('reservation');
  const start = params.get('start');
  const end = params.get('end');

  const reservation = useQuery({ queryKey: ['reservation', reservationId], queryFn: () => api.reservation(reservationId!), enabled: !!reservationId });
  const setReservation = (r: Reservation) => {
    queryClient.setQueryData(['reservation', r.id], r);
    void queryClient.invalidateQueries({ queryKey: ['reservations'] });
    void queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    setParams({ reservation: r.id }, { replace: true });
  };

  const r = reservation.data;
  const step = !reservationId ? 0 : r && (r.status === 'CONFIRMED' || r.status === 'ACTIVE' || r.status === 'COMPLETED') ? 2 : 1;

  let body;
  if (!reservationId) {
    body = start && end ? <ReviewStep slotId={slotId} start={start} end={end} onCreated={setReservation} /> : <ErrorState message="This booking link is incomplete. Please choose a slot and time again." />;
  } else if (reservation.error) body = <ErrorState message={reservation.error.message} onRetry={() => reservation.refetch()} />;
  else if (!r) body = <Skeleton className="h-80 w-full" />;
  else if (step === 2) body = <SuccessStep reservation={r} />;
  else if (r.status === 'PENDING') body = <PaymentStep reservation={r} onPaid={setReservation} />;
  else
    body = (
      <Card className="p-8 text-center">
        <StatusBadge status={r.status} />
        <p className="mt-3 text-sm text-slate-600">Booking <span className="font-mono font-semibold">{r.bookingRef}</span> is {r.status.toLowerCase()} and can no longer be paid for.</p>
        <ButtonLink to={`/parking/${r.area.id}`} className="mt-5">Book again</ButtonLink>
      </Card>
    );

  return (
    <>
      <PageHeader title={step === 2 ? 'You are all set' : step === 1 ? 'Complete your payment' : 'Review your booking'} back={step === 0 ? `/parking` : undefined} />
      <Stepper current={step} />
      {body}
    </>
  );
}
