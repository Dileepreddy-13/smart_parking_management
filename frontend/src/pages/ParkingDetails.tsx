import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { ArrowRight, CalendarClock, Clock, LogIn, MapPin, Navigation, Zap } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { api } from '../api';
import { Alert, Badge, Button, ButtonLink, Card, CardHeader, cx, ErrorState, PageHeader, Skeleton, SkeletonRows } from '../components/ui';
import { ParkingMap } from '../features/parking/ParkingMap';
import { customerVisual, SlotGrid, SlotLegend } from '../features/parking/SlotGrid';
import { VehicleIcon } from '../features/parking/vehicle';
import { useAuth } from '../contexts/AuthContext';
import { useGeolocation } from '../hooks/useGeolocation';
import type { VehicleType } from '../types';
import { DAY_NAMES, formatDuration, fromInputs, money, nextHalfHour, toDateInput, toTimeInput, vehicleLabel } from '../utils/format';

const HOUR = 3_600_000;

export function ParkingDetails() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const geo = useGeolocation();

  const initial = useMemo(() => nextHalfHour(), []);
  const [date, setDate] = useState(toDateInput(initial));
  const [startTime, setStartTime] = useState(toTimeInput(initial));
  const [endTime, setEndTime] = useState(toTimeInput(new Date(initial.getTime() + 2 * HOUR)));
  const [type, setType] = useState<VehicleType | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const start = fromInputs(date, startTime);
  // An end time earlier than the start means "the next day" (overnight parking).
  const rawEnd = fromInputs(date, endTime);
  const end = start && rawEnd ? (rawEnd <= start ? new Date(rawEnd.getTime() + 24 * HOUR) : rawEnd) : null;
  const hours = start && end ? (end.getTime() - start.getTime()) / HOUR : 0;
  const timeError = !start || !end ? 'Choose a date, start time and end time.' : start.getTime() < Date.now() - 60_000 ? 'The start time has already passed.' : hours < 0.5 ? 'Minimum booking is 30 minutes.' : null;

  const coords = geo.coords ?? undefined;
  const area = useQuery({ queryKey: ['area', id, coords], queryFn: () => api.area(id, coords), placeholderData: keepPreviousData });
  const vehicleType = type ?? area.data?.vehicleTypes.find((t) => t === 'CAR') ?? area.data?.vehicleTypes[0] ?? null;
  const window = !timeError && start && end ? { start: start.toISOString(), end: end.toISOString() } : null;
  const slots = useQuery({
    queryKey: ['slots', id, window, vehicleType],
    queryFn: () => api.slots(id, { ...window, vehicleType: vehicleType ?? '' }),
    enabled: !!area.data && !!vehicleType,
    placeholderData: keepPreviousData,
  });

  const selected = slots.data?.find((s) => s.id === selectedId && s.bookable) ?? null;
  const free = slots.data?.filter((s) => s.bookable).length ?? 0;
  const closedReason = slots.data?.find((s) => s.unavailableReason?.startsWith('Closed: '))?.unavailableReason?.slice(8) ?? null;

  if (area.error) return <ErrorState message={area.error.message} onRetry={() => area.refetch()} />;
  if (!area.data) return <div className="space-y-4"><Skeleton className="h-10 w-72" /><Skeleton className="h-64 w-full" /><SkeletonRows rows={2} className="h-40" /></div>;
  const a = area.data;
  const bookingUrl = selected && window ? `/booking/${selected.id}?start=${encodeURIComponent(window.start)}&end=${encodeURIComponent(window.end)}` : '';

  return (
    <>
      <PageHeader
        back="/parking"
        title={a.name}
        subtitle={<span className="inline-flex items-start gap-1"><MapPin className="mt-0.5 size-4 shrink-0" aria-hidden />{a.address}</span>}
        action={
          <>
            <Badge tone={a.isOpenNow ? 'green' : 'amber'} dot>{a.isOpenNow ? 'Open now' : 'Closed now'}</Badge>
            {a.distanceKm !== null && <Badge tone="blue"><Navigation className="size-3" aria-hidden />{a.distanceKm} km away</Badge>}
            {a.hasEvCharging && <Badge tone="violet"><Zap className="size-3" aria-hidden />EV charging</Badge>}
          </>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="space-y-6">
          <Card>
            <CardHeader title="Choose your time and bay" subtitle="Availability below is for the time you select." />
            <div className="space-y-5 p-5">
              <div className="grid gap-3 sm:grid-cols-3">
                <div>
                  <label htmlFor="date" className="field-label">Date</label>
                  <input id="date" type="date" className="field" min={toDateInput(new Date())} max={toDateInput(new Date(Date.now() + 30 * 24 * HOUR))} value={date} onChange={(e) => { setDate(e.target.value); setSelectedId(null); }} />
                </div>
                <div>
                  <label htmlFor="start" className="field-label">Start time</label>
                  <input id="start" type="time" step={900} className="field" value={startTime} onChange={(e) => { setStartTime(e.target.value); setSelectedId(null); }} />
                </div>
                <div>
                  <label htmlFor="end" className="field-label">End time</label>
                  <input id="end" type="time" step={900} className="field" value={endTime} onChange={(e) => { setEndTime(e.target.value); setSelectedId(null); }} />
                </div>
              </div>
              {timeError ? <Alert tone="amber">{timeError}</Alert> : closedReason ? <Alert tone="amber">{closedReason} Choose a different time.</Alert> : (
                <p className="flex flex-wrap items-center gap-x-2 text-sm text-slate-600">
                  <CalendarClock className="size-4 text-brand-600" aria-hidden />
                  <span>Parking for <b className="text-ink-900">{formatDuration(hours)}</b>{end && start && end.getDate() !== start.getDate() ? ' (ends the next day)' : ''}.</span>
                  {!a.is24x7 && <span className="text-slate-500">Open {a.todayHours.toLowerCase()} today.</span>}
                </p>
              )}

              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex gap-1 rounded-xl bg-slate-200/60 p-1" role="tablist" aria-label="Vehicle type">
                  {a.vehicleTypes.map((t) => (
                    <button key={t} type="button" role="tab" aria-selected={vehicleType === t} onClick={() => { setType(t); setSelectedId(null); }}
                      className={cx('flex items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-semibold', vehicleType === t ? 'bg-white text-ink-900 shadow-sm' : 'text-slate-600 hover:text-ink-900')}>
                      <VehicleIcon type={t} />{vehicleLabel[t]}
                    </button>
                  ))}
                </div>
                {slots.data && <p className="text-sm font-semibold text-emerald-700" data-testid="free-count">{free} of {slots.data.length} bays free</p>}
              </div>

              {slots.error ? <ErrorState message={slots.error.message} onRetry={() => slots.refetch()} />
                : !slots.data ? <SkeletonRows rows={2} className="h-20" />
                : slots.data.length === 0 ? <Alert>No {vehicleType ? vehicleLabel[vehicleType].toLowerCase() : ''} bays in this parking area.</Alert>
                : <div className={cx(slots.isFetching && 'opacity-60 transition-opacity')}><SlotGrid slots={slots.data} visual={customerVisual} selectedId={selected?.id} onSelect={(s) => setSelectedId(s.id === selectedId ? null : s.id)} /></div>}
              <SlotLegend />
            </div>
          </Card>

          <Card>
            <CardHeader title="About this parking area" />
            <div className="grid gap-6 p-5 md:grid-cols-2">
              <div>
                <p className="text-sm leading-relaxed text-slate-600">{a.description || 'No description provided.'}</p>
                <h3 className="mt-5 mb-2 text-sm font-semibold">Rates per hour</h3>
                <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200 text-sm">
                  {a.rates.map((r) => (
                    <li key={r.vehicleType} className="flex items-center justify-between px-3 py-2">
                      <span className="inline-flex items-center gap-2 text-slate-700"><VehicleIcon type={r.vehicleType} />{vehicleLabel[r.vehicleType]}</span>
                      <span className="font-semibold text-ink-900">{money(r.hourlyRate)}</span>
                    </li>
                  ))}
                </ul>
                <dl className="mt-4 grid grid-cols-2 gap-3 text-center">
                  <div className="rounded-lg bg-slate-50 p-3"><dt className="text-xs text-slate-500">Total bays</dt><dd className="font-display text-xl font-bold text-ink-900">{a.totalSlots}</dd></div>
                  <div className="rounded-lg bg-emerald-50 p-3"><dt className="text-xs text-emerald-700">Free right now</dt><dd className="font-display text-xl font-bold text-emerald-700">{a.availableSlots}</dd></div>
                </dl>
              </div>
              <div>
                <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold"><Clock className="size-4" aria-hidden />Operating hours</h3>
                {a.is24x7 ? <Alert tone="green">Open 24 hours, every day.</Alert> : (
                  <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200 text-sm">
                    {a.operatingHours.map((h) => (
                      <li key={h.dayOfWeek} className={cx('flex justify-between px-3 py-1.5', h.dayOfWeek === new Date().getDay() && 'bg-brand-50 font-semibold text-brand-700')}>
                        <span>{DAY_NAMES[h.dayOfWeek]}</span><span>{h.isClosed ? 'Closed' : `${h.openTime} – ${h.closeTime}`}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
            <div className="px-5 pb-5"><ParkingMap areas={[a]} me={geo.coords} linkToDetails={false} className="h-64" /></div>
          </Card>
        </div>

        <aside className="lg:sticky lg:top-20 lg:self-start">
          <Card className="overflow-hidden">
            <div className="bg-ink-900 px-5 py-4 text-white">
              <p className="text-xs font-semibold tracking-widest text-lane-400 uppercase">Your selection</p>
              <p className="mt-1 font-mono text-3xl font-bold" data-testid="selected-slot">{selected ? selected.slotNumber : '— —'}</p>
            </div>
            <div className="space-y-4 p-5">
              {selected ? (
                <dl className="space-y-2 text-sm">
                  <div className="flex justify-between"><dt className="text-slate-500">Bay type</dt><dd className="font-medium text-ink-900">{vehicleLabel[selected.vehicleType]}{selected.isEv ? ' · EV charger' : ''}</dd></div>
                  <div className="flex justify-between"><dt className="text-slate-500">Level</dt><dd className="font-medium text-ink-900">{selected.floor}</dd></div>
                  <div className="flex justify-between"><dt className="text-slate-500">Rate</dt><dd className="font-medium text-ink-900">{money(selected.price)} / hour</dd></div>
                  <div className="flex justify-between"><dt className="text-slate-500">Duration</dt><dd className="font-medium text-ink-900">{formatDuration(hours)}</dd></div>
                </dl>
              ) : (
                <p className="text-sm text-slate-500">Pick a green bay on the floor plan to continue. The exact price, including tax, is shown on the next step.</p>
              )}
              {user ? (
                <Button size="lg" className="w-full" disabled={!selected} onClick={() => navigate(bookingUrl)}>Review booking <ArrowRight className="size-4" /></Button>
              ) : (
                <ButtonLink to="/login" state={{ from: bookingUrl || location.pathname }} size="lg" className="w-full" icon={LogIn}>Log in to reserve</ButtonLink>
              )}
              <p className="text-center text-xs text-slate-500">Billed in 30-minute blocks. You pay only after reviewing the total.</p>
            </div>
          </Card>
        </aside>
      </div>

      {/* On phones the summary card sits below a long page, so the next step is pinned to the bottom. */}
      {selected && (
        <div className="fixed inset-x-0 bottom-0 z-20 flex items-center gap-3 border-t border-slate-200 bg-white/95 px-4 py-3 shadow-[0_-8px_24px_-12px_rgb(12_19_34/0.3)] backdrop-blur lg:hidden">
          <div className="min-w-0 flex-1">
            <p className="font-mono text-lg leading-tight font-bold text-ink-900">{selected.slotNumber}</p>
            <p className="truncate text-xs text-slate-500">{money(selected.price)}/h · {formatDuration(hours)}</p>
          </div>
          {user ? <Button onClick={() => navigate(bookingUrl)}>Review booking <ArrowRight className="size-4" /></Button> : <ButtonLink to="/login" state={{ from: bookingUrl }} icon={LogIn}>Log in to reserve</ButtonLink>}
        </div>
      )}
      {selected && <div className="h-20 lg:hidden" aria-hidden />}
    </>
  );
}
