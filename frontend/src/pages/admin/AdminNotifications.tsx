import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Send } from 'lucide-react';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import { z } from 'zod';
import { api } from '../../api';
import { notificationIcon } from '../../components/notificationMeta';
import { Alert, Badge, Button, Card, CardHeader, cx, ErrorState, Input, PageHeader, Select, SkeletonRows } from '../../components/ui';
import { useConfig } from '../../hooks/useConfig';
import { timeAgo, titleCase } from '../../utils/format';

const schema = z.object({
  userId: z.string(),
  title: z.string().trim().min(3, 'At least 3 characters').max(120),
  message: z.string().trim().min(3, 'Write a message').max(1000),
});

export function AdminNotifications() {
  const queryClient = useQueryClient();
  const { data: config } = useConfig();
  const recent = useQuery({ queryKey: ['admin', 'notifications'], queryFn: api.admin.notifications });
  const users = useQuery({ queryKey: ['admin', 'users', 'all'], queryFn: () => api.admin.users({ pageSize: 100 }) });
  const { register, handleSubmit, reset, formState: { errors } } = useForm({ resolver: zodResolver(schema), defaultValues: { userId: '', title: '', message: '' } });
  const send = useMutation({
    mutationFn: (v: z.infer<typeof schema>) => api.admin.broadcast({ title: v.title, message: v.message, userId: v.userId || undefined }),
    onSuccess: (r) => { toast.success(`Sent to ${r.sent} user${r.sent === 1 ? '' : 's'}`); reset(); void queryClient.invalidateQueries({ queryKey: ['admin', 'notifications'] }); },
  });

  return (
    <>
      <PageHeader title="Notifications" subtitle="Send announcements and review what the system has sent to users." />
      <div className="grid gap-6 xl:grid-cols-[24rem_minmax(0,1fr)]">
        <Card className="h-fit">
          <CardHeader title="Send an announcement" subtitle="Delivered in-app, instantly." />
          <form className="space-y-4 p-5" onSubmit={handleSubmit((v) => send.mutate(v))} noValidate>
            {send.error && <Alert tone="red">{send.error.message}</Alert>}
            <Select label="Send to" {...register('userId')}>
              <option value="">All active customers</option>
              {users.data?.items.filter((u) => u.role === 'USER').map((u) => <option key={u.id} value={u.id}>{u.name} ({u.email})</option>)}
            </Select>
            <Input label="Title" placeholder="e.g. Level 2 closed tonight" error={errors.title?.message} {...register('title')} />
            <div>
              <label htmlFor="broadcast-message" className="field-label">Message</label>
              <textarea id="broadcast-message" rows={4} className="field" {...register('message')} />
              {errors.message && <p className="field-error">{errors.message.message}</p>}
            </div>
            <Button type="submit" icon={Send} loading={send.isPending} className="w-full">Send notification</Button>
          </form>
          <div className="border-t border-slate-100 px-5 py-3 text-xs text-slate-500">
            E-mail delivery: {config?.emailEnabled ? <Badge tone="green">SMTP configured</Badge> : <Badge tone="amber">Simulated (logged on the server)</Badge>}
          </div>
        </Card>

        <Card>
          <CardHeader title="Recently sent" subtitle="Latest 100 notifications across all users" />
          {recent.error ? <div className="p-5"><ErrorState message={recent.error.message} /></div>
            : !recent.data ? <div className="p-5"><SkeletonRows rows={6} className="h-14" /></div>
            : recent.data.length === 0 ? <p className="p-10 text-center text-sm text-slate-500">Nothing has been sent yet.</p>
            : (
              <ul className="max-h-[70vh] divide-y divide-slate-100 overflow-y-auto">
                {recent.data.map((n) => {
                  const { icon: Icon, tone } = notificationIcon(n.type);
                  return (
                    <li key={n.id} className="flex gap-3 px-5 py-3">
                      <span className={cx('mt-0.5 grid size-8 shrink-0 place-items-center rounded-full', tone)}><Icon className="size-4" aria-hidden /></span>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                          <p className="text-sm font-semibold text-ink-900">{n.title}</p>
                          <span className="text-xs text-slate-400">{timeAgo(n.createdAt)}</span>
                        </div>
                        <p className="line-clamp-2 text-sm text-slate-600">{n.message}</p>
                        <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">To {n.user?.name ?? 'user'} <Badge>{titleCase(n.type)}</Badge>{n.isRead ? <span>Read</span> : <span className="font-semibold text-brand-600">Unread</span>}</p>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
        </Card>
      </div>
    </>
  );
}
