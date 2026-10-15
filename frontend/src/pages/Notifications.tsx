import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { BellOff, CheckCheck } from 'lucide-react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import { notificationIcon } from '../components/notificationMeta';
import { Button, Card, cx, EmptyState, ErrorState, PageHeader, SkeletonRows } from '../components/ui';
import { formatDateTime, timeAgo } from '../utils/format';

export function Notifications() {
  const queryClient = useQueryClient();
  const { data, error, refetch } = useQuery({ queryKey: ['notifications'], queryFn: api.notifications });
  const refresh = () => { void queryClient.invalidateQueries({ queryKey: ['notifications'] }); void queryClient.invalidateQueries({ queryKey: ['dashboard'] }); };
  const markAll = useMutation({ mutationFn: api.markAllRead, onSuccess: refresh });
  const markOne = useMutation({ mutationFn: api.markRead, onSuccess: refresh });

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Notifications" subtitle={data ? (data.unread > 0 ? `${data.unread} unread` : 'You are all caught up') : undefined}
        action={<Button variant="secondary" icon={CheckCheck} disabled={!data || data.unread === 0} loading={markAll.isPending} onClick={() => markAll.mutate()}>Mark all as read</Button>} />
      {error ? <ErrorState message={error.message} onRetry={() => refetch()} />
        : !data ? <SkeletonRows rows={5} className="h-20" />
        : data.items.length === 0 ? <EmptyState icon={BellOff} title="No notifications yet" message="Booking confirmations, payment receipts and reminders will show up here." />
        : (
          <Card>
            <ul className="divide-y divide-slate-100">
              {data.items.map((n) => {
                const { icon: Icon, tone } = notificationIcon(n.type);
                return (
                  <li key={n.id} className={cx('flex gap-4 px-4 py-4 sm:px-5', !n.isRead && 'bg-brand-50/50')}>
                    <span className={cx('grid size-10 shrink-0 place-items-center rounded-full', tone)}><Icon className="size-5" aria-hidden /></span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                        <p className="flex items-center gap-2 font-semibold text-ink-900">{n.title}{!n.isRead && <span className="size-2 rounded-full bg-brand-500" aria-label="unread" />}</p>
                        <time className="text-xs text-slate-400" dateTime={n.createdAt} title={formatDateTime(n.createdAt)}>{timeAgo(n.createdAt)}</time>
                      </div>
                      <p className="mt-0.5 text-sm leading-relaxed text-slate-600">{n.message}</p>
                      <div className="mt-2 flex gap-4 text-xs font-semibold">
                        {n.reservationId && <Link to={`/bookings/${n.reservationId}`} className="text-brand-600 hover:underline">View booking</Link>}
                        {!n.isRead && <button type="button" className="text-slate-500 hover:text-ink-900" onClick={() => markOne.mutate(n.id)}>Mark as read</button>}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          </Card>
        )}
    </div>
  );
}
