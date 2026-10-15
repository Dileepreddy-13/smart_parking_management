import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Pencil, Plus, Power, PowerOff, Settings2 } from 'lucide-react';
import { useState } from 'react';
import toast from 'react-hot-toast';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../../api';
import { Badge, Button, ButtonLink, ConfirmDialog, EmptyState, ErrorState, Modal, PageHeader, Progress, SkeletonRows, StatusBadge } from '../../components/ui';
import { AreaForm } from '../../features/admin/AreaForm';
import type { ParkingArea } from '../../types';
import { money } from '../../utils/format';

export function AdminParking() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<ParkingArea | null>(null);
  const [toggling, setToggling] = useState<ParkingArea | null>(null);
  const { data, error, refetch } = useQuery({ queryKey: ['admin', 'areas'], queryFn: () => api.areas({ includeInactive: true }) });
  const refresh = () => { void queryClient.invalidateQueries({ queryKey: ['admin'] }); void queryClient.invalidateQueries({ queryKey: ['areas'] }); };

  const create = useMutation({ mutationFn: api.createArea, onSuccess: (a) => { refresh(); setCreating(false); toast.success(`${a.name} created. Add its slots next.`); navigate(`/admin/parking/${a.id}`); } });
  const update = useMutation({ mutationFn: (v: Parameters<typeof api.updateArea>[1]) => api.updateArea(editing!.id, v), onSuccess: () => { refresh(); setEditing(null); toast.success('Parking area updated'); } });
  const toggle = useMutation({
    mutationFn: (a: ParkingArea) => (a.status === 'ACTIVE' ? api.deactivateArea(a.id) : api.updateArea(a.id, { status: 'ACTIVE' })),
    onSuccess: (a) => { refresh(); setToggling(null); toast.success(`${a.name} ${a.status === 'ACTIVE' ? 'reactivated' : 'deactivated'}`); },
    onError: (e) => toast.error(e.message),
  });

  return (
    <>
      <PageHeader title="Parking areas" subtitle="Create, edit and deactivate parking areas. Open one to manage rates, hours and slots." action={<Button icon={Plus} onClick={() => setCreating(true)}>Add parking area</Button>} />
      {error ? <ErrorState message={error.message} onRetry={() => refetch()} />
        : !data ? <SkeletonRows rows={5} className="h-14" />
        : data.length === 0 ? <EmptyState title="No parking areas yet" message="Create the first parking area to start taking reservations." action={<Button icon={Plus} onClick={() => setCreating(true)}>Add parking area</Button>} />
        : (
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Parking area</th><th>Slots</th><th className="w-48">Occupancy</th><th>From</th><th>Hours</th><th>Status</th><th className="text-right">Actions</th></tr></thead>
              <tbody>
                {data.map((a) => (
                  <tr key={a.id} className={a.status === 'INACTIVE' ? 'bg-slate-50 text-slate-500' : undefined}>
                    <td>
                      <Link to={`/admin/parking/${a.id}`} className="font-semibold text-ink-900 hover:text-brand-600">{a.name}</Link>
                      <p className="max-w-64 truncate text-xs text-slate-500">{a.address}</p>
                    </td>
                    <td><span className="font-semibold text-emerald-700">{a.availableSlots}</span> / {a.totalSlots} free</td>
                    <td><div className="flex items-center gap-2"><Progress value={a.occupancyPercent} /><span className="w-10 text-right text-xs font-semibold">{a.occupancyPercent}%</span></div></td>
                    <td>{money(a.pricePerHour)}<span className="text-xs text-slate-500">/h</span></td>
                    <td className="whitespace-nowrap">{a.is24x7 ? <Badge tone="blue">24 hours</Badge> : a.todayHours}</td>
                    <td><StatusBadge status={a.status} /></td>
                    <td>
                      <div className="flex justify-end gap-1">
                        <ButtonLink size="sm" variant="secondary" icon={Settings2} to={`/admin/parking/${a.id}`}>Manage</ButtonLink>
                        <Button size="sm" variant="ghost" icon={Pencil} onClick={() => setEditing(a)} aria-label={`Edit ${a.name}`}>Edit</Button>
                        <Button size="sm" variant="ghost" icon={a.status === 'ACTIVE' ? PowerOff : Power} className={a.status === 'ACTIVE' ? '!text-red-600 hover:!bg-red-50' : '!text-emerald-700 hover:!bg-emerald-50'} onClick={() => setToggling(a)}>
                          {a.status === 'ACTIVE' ? 'Deactivate' : 'Reactivate'}
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

      <Modal open={creating} onClose={() => setCreating(false)} title="Add parking area" size="lg">
        <AreaForm saving={create.isPending} error={create.error?.message} onSubmit={(v) => create.mutate(v)} onCancel={() => setCreating(false)} />
      </Modal>
      <Modal open={!!editing} onClose={() => setEditing(null)} title={`Edit ${editing?.name ?? ''}`} size="lg">
        {editing && <AreaForm key={editing.id} area={editing} saving={update.isPending} error={update.error?.message} onSubmit={(v) => update.mutate(v)} onCancel={() => setEditing(null)} />}
      </Modal>
      <ConfirmDialog
        open={!!toggling}
        danger={toggling?.status === 'ACTIVE'}
        title={toggling?.status === 'ACTIVE' ? 'Deactivate this parking area?' : 'Reactivate this parking area?'}
        confirmLabel={toggling?.status === 'ACTIVE' ? 'Deactivate' : 'Reactivate'}
        loading={toggle.isPending}
        onClose={() => setToggling(null)}
        onConfirm={() => toggling && toggle.mutate(toggling)}
        message={toggling?.status === 'ACTIVE'
          ? <><b>{toggling.name}</b> will disappear from search and customers will not be able to make new bookings there. Existing bookings and all history are kept, and you can reactivate it at any time.</>
          : <><b>{toggling?.name}</b> will be visible to customers and bookable again.</>}
      />
    </>
  );
}
