import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { CalendarX2, Search } from 'lucide-react';
import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api, type BookingTab } from '../api';
import { Button, ButtonLink, EmptyState, ErrorState, PageHeader, Pagination, SkeletonRows, Tabs } from '../components/ui';
import { BookingCard } from '../features/booking/BookingCard';
import { CancelBookingDialog } from '../features/booking/CancelBookingDialog';
import type { Reservation } from '../types';

const TABS: Array<{ id: BookingTab; label: string; empty: string }> = [
  { id: 'upcoming', label: 'Upcoming', empty: 'You have no upcoming bookings.' },
  { id: 'active', label: 'Active', empty: 'Nothing is parked right now.' },
  { id: 'completed', label: 'Completed', empty: 'Completed bookings will appear here.' },
  { id: 'cancelled', label: 'Cancelled', empty: 'No cancelled or expired bookings.' },
];

export function Bookings() {
  const [params, setParams] = useSearchParams();
  const tab = (TABS.find((t) => t.id === params.get('tab'))?.id ?? 'upcoming') as BookingTab;
  const page = Number(params.get('page') ?? 1);
  const [cancelling, setCancelling] = useState<Reservation | null>(null);

  const { data, error, refetch, isPending } = useQuery({
    queryKey: ['reservations', tab, page],
    queryFn: () => api.reservations({ tab, page, pageSize: 10 }),
    placeholderData: keepPreviousData,
  });

  return (
    <>
      <PageHeader title="My bookings" subtitle="Your current and previous parking reservations." action={<ButtonLink to="/parking" icon={Search}>Find parking</ButtonLink>} />
      <Tabs tabs={TABS.map((t) => ({ id: t.id, label: t.label, count: data?.counts[t.id] }))} value={tab} onChange={(id) => setParams({ tab: id })} />
      <div className="mt-5 space-y-3">
        {error ? <ErrorState message={error.message} onRetry={() => refetch()} />
          : isPending || !data ? <SkeletonRows rows={3} className="h-32" />
          : data.items.length === 0 ? <EmptyState icon={CalendarX2} title={TABS.find((t) => t.id === tab)!.empty} action={tab === 'upcoming' && <ButtonLink to="/parking">Find parking</ButtonLink>} />
          : data.items.map((b) => (
              <BookingCard key={b.id} booking={b} actions={
                <>
                  {b.status === 'PENDING' && <ButtonLink size="sm" to={`/booking/${b.slot.id}?reservation=${b.id}`}>Pay now</ButtonLink>}
                  <ButtonLink size="sm" variant="secondary" to={`/bookings/${b.id}`}>View details</ButtonLink>
                  {b.payment?.status === 'SUCCESS' || b.payment?.status === 'REFUNDED' ? <ButtonLink size="sm" variant="secondary" to={`/bookings/${b.id}?receipt=1`}>View receipt</ButtonLink> : null}
                  {b.cancellation.allowed && <Button size="sm" variant="ghost" className="!text-red-600 hover:!bg-red-50" onClick={() => setCancelling(b)}>Cancel booking</Button>}
                </>
              } />
            ))}
        {data && <Pagination page={data.page} pageSize={data.pageSize} total={data.total} onChange={(p) => setParams({ tab, page: String(p) })} />}
      </div>
      <CancelBookingDialog booking={cancelling} onClose={() => setCancelling(null)} />
    </>
  );
}
