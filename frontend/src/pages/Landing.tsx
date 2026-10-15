import { ArrowRight, BellRing, CalendarCheck, CreditCard, LogIn, MapPinned, Radio, Search, ShieldCheck, Zap } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../api';
import { ButtonLink } from '../components/ui';
import { useAuth } from '../contexts/AuthContext';
import { money } from '../utils/format';

const FEATURES = [
  { icon: MapPinned, title: 'Find nearby parking', text: 'Search by area or browse the map. Every pin shows how many bays are free right now.' },
  { icon: Radio, title: 'Real-time availability', text: 'Slot status updates live as bays are reserved, occupied or released.' },
  { icon: CalendarCheck, title: 'Easy reservations', text: 'Pick a bay, pick your hours, and it is held for you. No circling the block.' },
  { icon: CreditCard, title: 'Secure payments', text: 'Pay online before you arrive. The price is calculated up front, taxes included.' },
  { icon: BellRing, title: 'Smart notifications', text: 'Confirmation, payment receipt and a reminder 30 minutes before your slot starts.' },
];
const STEPS = [
  { n: '1', title: 'Find', text: 'Search a location and compare price, distance and free bays.' },
  { n: '2', title: 'Reserve', text: 'Choose a bay on the floor plan and set your arrival and exit time.' },
  { n: '3', title: 'Pay', text: 'Confirm the total and pay online to lock the bay in.' },
  { n: '4', title: 'Park', text: 'Drive in and show your booking QR. Your bay is waiting.' },
];

export function Landing() {
  const { user } = useAuth();
  const { data: areas } = useQuery({ queryKey: ['areas', { landing: true }], queryFn: () => api.areas({ sort: 'availability' }) });
  const free = areas?.reduce((sum, a) => sum + a.availableSlots, 0);

  return (
    <>
      <section className="relative overflow-hidden bg-ink-900 pt-16 text-white">
        <div className="lane-stripes absolute inset-0" aria-hidden />
        <div className="absolute -top-40 -right-40 size-[520px] rounded-full bg-brand-600/30 blur-3xl" aria-hidden />
        <div className="relative mx-auto grid max-w-6xl gap-12 px-4 py-16 sm:px-6 lg:grid-cols-[1.1fr_0.9fr] lg:items-center lg:py-24">
          <div className="animate-rise">
            <p className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs font-semibold tracking-wide text-lane-300">
              <span className="size-2 animate-pulse rounded-full bg-emerald-400" /> {free !== undefined ? `${free} bays free across Hyderabad right now` : 'Live parking availability'}
            </p>
            <h1 className="font-display text-5xl leading-[1.05] font-bold !text-white sm:text-6xl lg:text-7xl">
              Find. Reserve. <span className="text-lane-400">Park.</span>
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-slate-300">
              See which parking bays are free, book one for the hours you need and pay before you leave home. The bay is yours when you arrive.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <ButtonLink to="/parking" variant="accent" size="lg" icon={Search}>Find Parking</ButtonLink>
              {user ? (
                <ButtonLink to="/dashboard" variant="secondary" size="lg" className="!border-white/20 !bg-white/10 !text-white hover:!bg-white/20">Go to dashboard <ArrowRight className="size-4" /></ButtonLink>
              ) : (
                <ButtonLink to="/login" variant="secondary" size="lg" icon={LogIn} className="!border-white/20 !bg-white/10 !text-white hover:!bg-white/20">Login</ButtonLink>
              )}
            </div>
            <ul className="mt-10 flex flex-wrap gap-x-8 gap-y-3 text-sm text-slate-300">
              <li className="flex items-center gap-2"><ShieldCheck className="size-4 text-emerald-400" /> No double bookings</li>
              <li className="flex items-center gap-2"><Zap className="size-4 text-lane-400" /> EV charging bays</li>
              <li className="flex items-center gap-2"><CreditCard className="size-4 text-brand-200" /> Free cancellation window</li>
            </ul>
          </div>

          {/* A miniature of the real slot grid, so the product explains itself. */}
          <div className="animate-rise rounded-2xl border border-white/10 bg-ink-800/80 p-5 shadow-2xl backdrop-blur" aria-hidden>
            <div className="mb-4 flex items-center justify-between">
              <div>
                <p className="font-display font-semibold text-white">{areas?.[0]?.name ?? 'HITEC City Parking'}</p>
                <p className="text-xs text-slate-400">Level 1 · live</p>
              </div>
              <span className="rounded-full bg-emerald-500/15 px-2.5 py-1 text-xs font-semibold text-emerald-300">{areas?.[0]?.availableSlots ?? 12} free</span>
            </div>
            <div className="grid grid-cols-6 gap-2">
              {['a', 'a', 'o', 'a', 'r', 'a', 'a', 'o', 'a', 'a', 'm', 'a', 'r', 'a', 'a', 'o', 'a', 'a'].map((s, i) => (
                <div key={i} className={`flex h-14 items-end justify-center rounded-md border-x-2 border-t-2 border-dashed pb-1 font-mono text-[10px] font-bold ${s === 'a' ? 'border-emerald-400/60 bg-emerald-400/10 text-emerald-300' : s === 'o' ? 'border-red-400/50 bg-red-400/15 text-red-300' : s === 'r' ? 'border-amber-400/60 bg-amber-400/15 text-amber-300' : 'hatch border-slate-500/50 text-slate-400'}`}>
                  A-{101 + i}
                </div>
              ))}
            </div>
            <div className="mt-4 flex flex-wrap gap-4 text-xs text-slate-400">
              <span className="flex items-center gap-1.5"><i className="size-2.5 rounded-sm bg-emerald-400" />Available</span>
              <span className="flex items-center gap-1.5"><i className="size-2.5 rounded-sm bg-amber-400" />Reserved</span>
              <span className="flex items-center gap-1.5"><i className="size-2.5 rounded-sm bg-red-400" />Occupied</span>
              <span className="flex items-center gap-1.5"><i className="size-2.5 rounded-sm bg-slate-500" />Maintenance</span>
            </div>
          </div>
        </div>
        <div className="h-2 bg-[repeating-linear-gradient(90deg,var(--color-lane-400)_0_40px,transparent_40px_80px)] opacity-80" aria-hidden />
      </section>

      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:py-20">
        <h2 className="text-3xl font-bold">How it works</h2>
        <p className="mt-2 max-w-xl text-slate-600">Four steps from your sofa to a parked car.</p>
        <ol className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((s) => (
            <li key={s.n} className="relative rounded-2xl border border-slate-200 bg-white p-6 shadow-card">
              <span className="font-display text-5xl font-bold text-brand-100">{s.n}</span>
              <h3 className="mt-2 text-xl font-semibold">{s.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">{s.text}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="border-y border-slate-200 bg-slate-50">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:py-20">
          <h2 className="text-3xl font-bold">Everything a driver needs</h2>
          <div className="mt-10 grid gap-x-10 gap-y-8 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f) => (
              <div key={f.title} className="flex gap-4">
                <div className="grid size-11 shrink-0 place-items-center rounded-xl bg-brand-600 text-white shadow-sm"><f.icon className="size-5" aria-hidden /></div>
                <div>
                  <h3 className="font-semibold">{f.title}</h3>
                  <p className="mt-1 text-sm leading-relaxed text-slate-600">{f.text}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {areas && areas.length > 0 && (
        <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <h2 className="text-3xl font-bold">Parking areas</h2>
            <ButtonLink to="/parking" variant="secondary">View all on the map <ArrowRight className="size-4" /></ButtonLink>
          </div>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {areas.slice(0, 3).map((a) => (
              <ButtonLink key={a.id} to={`/parking/${a.id}`} variant="secondary" className="!h-auto !justify-start !p-5 text-left !whitespace-normal">
                <span className="block w-full">
                  <span className="block font-display text-lg font-semibold text-ink-900">{a.name}</span>
                  <span className="mt-1 block text-sm font-normal text-slate-500">{a.address}</span>
                  <span className="mt-4 flex items-center justify-between text-sm">
                    <span className="font-semibold text-emerald-700">{a.availableSlots} of {a.totalSlots} free</span>
                    <span className="font-normal text-slate-600">from <b className="font-semibold text-ink-900">{money(a.pricePerHour)}</b>/h</span>
                  </span>
                </span>
              </ButtonLink>
            ))}
          </div>
        </section>
      )}

      <footer className="mt-auto bg-ink-900 py-8 text-center text-sm text-slate-400">
        Smart Parking Management System · Software Engineering case study · Payments run in test mode only.
      </footer>
    </>
  );
}
