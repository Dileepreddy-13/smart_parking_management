import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Eye, Search, UserCheck, UserX } from 'lucide-react';
import { useState } from 'react';
import toast from 'react-hot-toast';
import { api } from '../../api';
import { Badge, Button, ConfirmDialog, EmptyState, ErrorState, Modal, PageHeader, Pagination, SkeletonRows, Spinner, StatusBadge } from '../../components/ui';
import { VehicleIcon } from '../../features/parking/vehicle';
import { useAuth } from '../../contexts/AuthContext';
import { useDebounce } from '../../hooks/useDebounce';
import type { AdminUser } from '../../types';
import { formatDate, money, vehicleLabel } from '../../utils/format';

function UserDetails({ id }: { id: string }) {
  const { data, error } = useQuery({ queryKey: ['admin', 'user', id], queryFn: () => api.admin.user(id) });
  if (error) return <ErrorState message={error.message} />;
  if (!data) return <Spinner />;
  return (
    <div className="space-y-5">
      <div className="flex items-center gap-4">
        <span className="grid size-14 place-items-center rounded-full bg-brand-100 font-display text-2xl font-bold text-brand-700">{data.name.charAt(0)}</span>
        <div><p className="font-display text-xl font-semibold text-ink-900">{data.name}</p><p className="text-sm text-slate-500">{data.email}</p></div>
        <div className="ml-auto flex flex-col items-end gap-1"><StatusBadge status={data.status} /><Badge tone={data.role === 'ADMIN' ? 'violet' : 'blue'}>{data.role === 'ADMIN' ? 'Administrator' : 'Customer'}</Badge></div>
      </div>
      <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
        <div className="rounded-lg bg-slate-50 p-3"><dt className="text-xs text-slate-500">Phone</dt><dd className="font-semibold text-ink-900">{data.phone ?? '—'}</dd></div>
        <div className="rounded-lg bg-slate-50 p-3"><dt className="text-xs text-slate-500">Registered</dt><dd className="font-semibold text-ink-900">{formatDate(data.createdAt)}</dd></div>
        <div className="rounded-lg bg-slate-50 p-3"><dt className="text-xs text-slate-500">Bookings</dt><dd className="font-semibold text-ink-900">{data.bookings}</dd></div>
        <div className="rounded-lg bg-slate-50 p-3"><dt className="text-xs text-slate-500">Total spent</dt><dd className="font-semibold text-ink-900">{money(data.totalSpent)}</dd></div>
      </dl>
      <div>
        <h3 className="mb-2 text-sm font-semibold">Vehicles</h3>
        {data.vehicles?.length ? (
          <ul className="flex flex-wrap gap-2">{data.vehicles.map((v) => <li key={v.id} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-1.5 text-sm"><VehicleIcon type={v.vehicleType} /><span className="font-mono font-semibold">{v.vehicleNumber}</span><span className="text-xs text-slate-500">{vehicleLabel[v.vehicleType]}</span></li>)}</ul>
        ) : <p className="text-sm text-slate-500">No vehicles saved.</p>}
      </div>
      <p className="text-xs text-slate-400">Passwords are stored as one-way bcrypt hashes and are never shown to anyone, including administrators.</p>
    </div>
  );
}

export function AdminUsers() {
  const queryClient = useQueryClient();
  const { user: me } = useAuth();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const q = useDebounce(search.trim());
  const [viewing, setViewing] = useState<AdminUser | null>(null);
  const [toggling, setToggling] = useState<AdminUser | null>(null);
  const { data, error, refetch, isPending } = useQuery({ queryKey: ['admin', 'users', { q, page }], queryFn: () => api.admin.users({ q, page, pageSize: 15 }), placeholderData: keepPreviousData });
  const toggle = useMutation({
    mutationFn: (u: AdminUser) => api.admin.setUserStatus(u.id, u.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE'),
    onSuccess: (u) => { void queryClient.invalidateQueries({ queryKey: ['admin'] }); setToggling(null); toast.success(`${u.name} ${u.status === 'ACTIVE' ? 'activated' : 'deactivated'}`); },
    onError: (e) => { setToggling(null); toast.error(e.message); },
  });

  return (
    <>
      <PageHeader title="Users" subtitle="Everyone registered on the platform." />
      <div className="relative mb-4 max-w-md">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-400" aria-hidden />
        <input type="search" className="field pl-9" placeholder="Search by name, email or phone" aria-label="Search users" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
      </div>
      {error ? <ErrorState message={error.message} onRetry={() => refetch()} />
        : isPending || !data ? <SkeletonRows rows={6} className="h-12" />
        : data.items.length === 0 ? <EmptyState title="No users found" />
        : (
          <>
            <div className="table-wrap">
              <table className="table">
                <thead><tr><th>User name</th><th>Email</th><th>Phone</th><th>Registered</th><th>Bookings</th><th>Status</th><th className="text-right">Actions</th></tr></thead>
                <tbody>
                  {data.items.map((u) => (
                    <tr key={u.id}>
                      <td><span className="font-semibold text-ink-900">{u.name}</span>{u.role === 'ADMIN' && <span className="ml-2"><Badge tone="violet">Admin</Badge></span>}</td>
                      <td>{u.email}</td>
                      <td className="whitespace-nowrap">{u.phone ?? '—'}</td>
                      <td className="whitespace-nowrap">{formatDate(u.createdAt)}</td>
                      <td>{u.bookings}</td>
                      <td><StatusBadge status={u.status} /></td>
                      <td>
                        <div className="flex justify-end gap-1">
                          <Button size="sm" variant="ghost" icon={Eye} onClick={() => setViewing(u)} aria-label={`View ${u.name}`}>View</Button>
                          {u.id !== me?.id && (
                            <Button size="sm" variant="ghost" icon={u.status === 'ACTIVE' ? UserX : UserCheck} className={u.status === 'ACTIVE' ? '!text-red-600 hover:!bg-red-50' : '!text-emerald-700 hover:!bg-emerald-50'} onClick={() => setToggling(u)}>
                              {u.status === 'ACTIVE' ? 'Deactivate' : 'Activate'}
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination page={data.page} pageSize={data.pageSize} total={data.total} onChange={setPage} />
          </>
        )}
      <Modal open={!!viewing} onClose={() => setViewing(null)} title="User details">{viewing && <UserDetails id={viewing.id} />}</Modal>
      <ConfirmDialog open={!!toggling} danger={toggling?.status === 'ACTIVE'} loading={toggle.isPending} onClose={() => setToggling(null)} onConfirm={() => toggling && toggle.mutate(toggling)}
        title={toggling?.status === 'ACTIVE' ? 'Deactivate this user?' : 'Activate this user?'} confirmLabel={toggling?.status === 'ACTIVE' ? 'Deactivate user' : 'Activate user'}
        message={toggling?.status === 'ACTIVE'
          ? <><b>{toggling.name}</b> will be signed out immediately and will not be able to log in or book until reactivated. Their existing bookings are not cancelled.</>
          : <><b>{toggling?.name}</b> will be able to log in and book again.</>} />
    </>
  );
}
