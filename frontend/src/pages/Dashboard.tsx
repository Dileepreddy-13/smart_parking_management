import { useQuery } from '@tanstack/react-query';
import { ArrowRight, Ban, CalendarCheck, CircleCheckBig, MapPinned, Search, Ticket, Wallet } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Bar, BarChart, CartesianGrid, Tooltip, XAxis, YAxis } from 'recharts';
import { api } from '../api';
import { axisProps, CHART, ChartBox, tooltipProps } from '../components/charts';
import { notificationIcon } from '../components/notificationMeta';
import { ButtonLink, Card, CardHeader, cx, EmptyState, ErrorState, Skeleton, SkeletonRows, StatCard, StatusBadge } from '../components/ui';
import { BookingCard } from '../features/booking/BookingCard';
import { useAuth } from '../contexts/AuthContext';
import { useCountdown } from '../hooks/useCountdown';
import { useGeolocation } from '../hooks/useGeolocation';
import { formatDate, money, timeAgo } from '../utils/format';

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
}

function TimeLeft({ until }: { until: string }) {
  const { seconds } = useCountdown(until);
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return <>{h > 0 ? `${h} h ` : ''}{m} min left</>;
}

export function Dashboard() {
  const { user } = useAuth();
  const geo = useGeolocation();
  const { data, error, refetch } = useQuery({ queryKey: ['dashboard'], queryFn: api.dashboard });
  const nearby = useQuery({
    queryKey: ['areas', { nearby: geo.coords }],
    queryFn: () => api.areas({ sort: geo.coords ? 'distance' : 'availability', availableOnly: true, lat: geo.coords?.lat, lng: geo.coords?.lng }),
  });

  if (error) return <ErrorState message={error.message} onRetry={() => refetch()} />;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold sm:text-3xl">{greeting()}, {user?.name.split(' ')[0]}</h1>
          <p className="mt-1 text-sm text-slate-500">Here is what is happening with your parking.</p>
        </div>
        <ButtonLink to="/parking" icon={Search} variant="accent">Find parking</ButtonLink>
      </div>

      {!data ? <Skeleton className="h-36 w-full" /> : data.activeReservation ? (
        <section aria-label="Active reservation" className="overflow-hidden rounded-2xl bg-ink-900 text-white shadow-card">
          <div className="lane-stripes flex flex-wrap items-center justify-between gap-5 p-5 sm:p-6">
            <div>
              <p className="flex items-center gap-2 text-xs font-semibold tracking-widest text-emerald-300 uppercase"><span className="size-2 animate-pulse rounded-full bg-emerald-400" />Parked now</p>
              <p className="mt-2 font-display text-2xl font-bold">{data.activeReservation.area.name}</p>
              <p className="text-sm text-slate-300">Bay <span className="font-mono font-bold text-lane-400">{data.activeReservation.slot.slotNumber}</span> · <TimeLeft until={data.activeReservation.endTime} /></p>
            </div>
            <ButtonLink to={`/bookings/${data.activeReservation.id}`} variant="accent">View booking <ArrowRight className="size-4" /></ButtonLink>
          </div>
        </section>
      ) : null}

      <section aria-label="Upcoming reservation">
        <h2 className="mb-3 text-lg font-semibold">Upcoming reservation</h2>
        {!data ? <Skeleton className="h-32 w-full" /> : data.upcomingReservation ? (
          <BookingCard booking={data.upcomingReservation} highlight="Next up" actions={<ButtonLink size="sm" variant="secondary" to={`/bookings/${data.upcomingReservation.id}`}>View details</ButtonLink>} />
        ) : (
          <EmptyState icon={CalendarCheck} title="No upcoming reservations" message="Book a bay ahead of time and it will be waiting when you arrive." action={<ButtonLink to="/parking">Find parking</ButtonLink>} />
        )}
      </section>

      <section aria-label="Your statistics" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {!data ? Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-20" />) : (
          <>
            <StatCard label="Total bookings" value={data.stats.totalBookings} icon={Ticket} tone="blue" />
            <StatCard label="Completed" value={data.stats.completedBookings} icon={CircleCheckBig} tone="green" />
            <StatCard label="Cancelled" value={data.stats.cancelledBookings} icon={Ban} tone="red" />
            <StatCard label="Total spent" value={money(data.stats.totalSpent)} icon={Wallet} tone="amber" />
          </>
        )}
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Available parking nearby" subtitle={geo.coords ? 'Closest areas with free bays' : 'Areas with the most free bays'} action={<Link to="/parking" className="text-sm font-semibold text-brand-600 hover:underline">See all</Link>} />
          <div className="p-3">
            {!nearby.data ? <SkeletonRows rows={3} className="h-14" /> : nearby.data.length === 0 ? <p className="p-6 text-center text-sm text-slate-500">No free bays right now.</p> : (
              <ul className="divide-y divide-slate-100">
                {nearby.data.slice(0, 4).map((a) => (
                  <li key={a.id}>
                    <Link to={`/parking/${a.id}`} className="flex items-center gap-3 rounded-lg px-2 py-3 hover:bg-slate-50">
                      <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-emerald-100 font-mono text-sm font-bold text-emerald-700">{a.availableSlots}</span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold text-ink-900">{a.name}</span>
                        <span className="block truncate text-xs text-slate-500">{a.distanceKm !== null ? `${a.distanceKm} km · ` : ''}{a.todayHours}</span>
                      </span>
                      <span className="text-sm font-semibold text-ink-900">{money(a.pricePerHour)}<span className="text-xs font-normal text-slate-500">/h</span></span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Card>

        <Card>
          <CardHeader title="Your bookings by month" subtitle="Paid bookings in the last 6 months" />
          <div className="p-4">
            {!data ? <Skeleton className="h-56" /> : data.bookingsByMonth.length === 0 ? <p className="grid h-56 place-items-center text-sm text-slate-500">Your booking history will be charted here.</p> : (
              <ChartBox height={224} label="Bar chart of bookings per month">
                <BarChart data={data.bookingsByMonth.map((m) => ({ ...m, label: new Date(`${m.month}-01T00:00:00`).toLocaleDateString('en-IN', { month: 'short' }) }))} margin={{ top: 8, right: 8, left: -24, bottom: 0 }}>
                  <CartesianGrid vertical={false} stroke={CHART.grid} />
                  <XAxis dataKey="label" {...axisProps} />
                  <YAxis allowDecimals={false} {...axisProps} axisLine={false} />
                  <Tooltip {...tooltipProps} />
                  <Bar isAnimationActive={false} dataKey="bookings" name="Bookings" fill={CHART.brand} radius={[6, 6, 0, 0]} maxBarSize={48} />
                </BarChart>
              </ChartBox>
            )}
          </div>
        </Card>

        <Card>
          <CardHeader title="Recent payments" />
          {!data ? <div className="p-4"><SkeletonRows rows={3} className="h-12" /></div> : data.recentPayments.length === 0 ? <p className="p-8 text-center text-sm text-slate-500">No payments yet.</p> : (
            <ul className="divide-y divide-slate-100">
              {data.recentPayments.map((p) => (
                <li key={p.id}>
                  <Link to={`/bookings/${p.reservation.id}`} className="flex items-center justify-between gap-3 px-5 py-3 hover:bg-slate-50">
                    <span>
                      <span className="block font-mono text-sm font-semibold text-ink-900">{p.reservation.bookingRef}</span>
                      <span className="block text-xs text-slate-500">{formatDate(p.paidAt ?? p.createdAt)}</span>
                    </span>
                    <span className="flex items-center gap-3"><StatusBadge status={p.status} kind="payment" /><span className="w-16 text-right text-sm font-semibold text-ink-900">{money(p.amount)}</span></span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <CardHeader title="Notifications" action={<Link to="/notifications" className="text-sm font-semibold text-brand-600 hover:underline">View all{data && data.notifications.unread > 0 ? ` (${data.notifications.unread} new)` : ''}</Link>} />
          {!data ? <div className="p-4"><SkeletonRows rows={3} className="h-12" /></div> : data.notifications.items.length === 0 ? <p className="p-8 text-center text-sm text-slate-500">Nothing new.</p> : (
            <ul className="divide-y divide-slate-100">
              {data.notifications.items.map((n) => {
                const { icon: Icon, tone } = notificationIcon(n.type);
                return (
                  <li key={n.id} className={cx('flex gap-3 px-5 py-3', !n.isRead && 'bg-brand-50/50')}>
                    <span className={cx('mt-0.5 grid size-8 shrink-0 place-items-center rounded-full', tone)}><Icon className="size-4" aria-hidden /></span>
                    <span className="min-w-0">
                      <span className="block text-sm font-semibold text-ink-900">{n.title}</span>
                      <span className="line-clamp-1 text-xs text-slate-600">{n.message}</span>
                      <span className="text-[11px] text-slate-400">{timeAgo(n.createdAt)}</span>
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      </div>
      <p className="flex items-center justify-center gap-2 text-xs text-slate-400"><MapPinned className="size-3.5" aria-hidden />Availability updates live while this page is open.</p>
    </div>
  );
}
