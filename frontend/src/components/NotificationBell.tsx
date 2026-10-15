import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Bell, CheckCheck } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import { timeAgo } from '../utils/format';
import { cx } from './ui';
import { notificationIcon } from './notificationMeta';

export function NotificationBell({ dark }: { dark?: boolean }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();
  const { data } = useQuery({ queryKey: ['notifications'], queryFn: api.notifications });
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['notifications'] });
  const markAll = useMutation({ mutationFn: api.markAllRead, onSuccess: refresh });
  const markOne = useMutation({ mutationFn: api.markRead, onSuccess: refresh });

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === 'Escape' : !ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', close);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', close);
    };
  }, [open]);

  const unread = data?.unread ?? 0;
  const items = data?.items.slice(0, 6) ?? [];

  return (
    <div className="relative" ref={ref}>
      <button type="button" onClick={() => setOpen((o) => !o)} aria-label={`Notifications, ${unread} unread`} aria-expanded={open}
        className={cx('relative rounded-lg p-2 transition-colors', dark ? 'text-slate-300 hover:bg-white/10 hover:text-white' : 'text-slate-600 hover:bg-slate-100')}>
        <Bell className="size-5" />
        {unread > 0 && <span data-testid="unread-count" className="absolute -top-0.5 -right-0.5 grid h-5 min-w-5 place-items-center rounded-full bg-red-600 px-1 text-[11px] font-bold text-white ring-2 ring-white">{unread > 9 ? '9+' : unread}</span>}
      </button>
      {open && (
        <div className="absolute right-0 z-40 mt-2 w-[min(22rem,calc(100vw-2rem))] animate-rise overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
            <p className="font-display font-semibold text-ink-900">Notifications</p>
            <button type="button" disabled={unread === 0} onClick={() => markAll.mutate()} className="inline-flex items-center gap-1 text-xs font-semibold text-brand-600 hover:underline disabled:text-slate-400 disabled:no-underline">
              <CheckCheck className="size-3.5" /> Mark all as read
            </button>
          </div>
          {items.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-slate-500">You're all caught up.</p>
          ) : (
            <ul className="max-h-96 divide-y divide-slate-100 overflow-y-auto">
              {items.map((n) => {
                const { icon: Icon, tone } = notificationIcon(n.type);
                return (
                  <li key={n.id}>
                    <button type="button" onClick={() => !n.isRead && markOne.mutate(n.id)} className={cx('flex w-full gap-3 px-4 py-3 text-left hover:bg-slate-50', !n.isRead && 'bg-brand-50/60')}>
                      <span className={cx('mt-0.5 grid size-8 shrink-0 place-items-center rounded-full', tone)}><Icon className="size-4" /></span>
                      <span className="min-w-0">
                        <span className="flex items-center gap-2 text-sm font-semibold text-ink-900">{n.title}{!n.isRead && <span className="size-2 rounded-full bg-brand-500" aria-label="unread" />}</span>
                        <span className="line-clamp-2 text-xs text-slate-600">{n.message}</span>
                        <span className="mt-0.5 block text-[11px] text-slate-400">{timeAgo(n.createdAt)}</span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
          <Link to="/notifications" onClick={() => setOpen(false)} className="block border-t border-slate-100 py-2.5 text-center text-sm font-semibold text-brand-600 hover:bg-slate-50">View all</Link>
        </div>
      )}
    </div>
  );
}
