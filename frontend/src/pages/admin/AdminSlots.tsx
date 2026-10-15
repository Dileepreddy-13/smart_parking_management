import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Pencil, Plus, Trash2, Zap } from 'lucide-react';
import { useState } from 'react';
import toast from 'react-hot-toast';
import { useSearchParams } from 'react-router-dom';
import { api } from '../../api';
import { Button, ConfirmDialog, EmptyState, ErrorState, PageHeader, SkeletonRows, StatusBadge } from '../../components/ui';
import { SlotFormModal } from '../../features/admin/SlotForm';
import { VehicleIcon } from '../../features/parking/vehicle';
import type { Slot, SlotStatus } from '../../types';
import { money, titleCase, vehicleLabel } from '../../utils/format';

const SETTABLE: Array<Exclude<SlotStatus, 'RESERVED'>> = ['AVAILABLE', 'OCCUPIED', 'MAINTENANCE'];

export function AdminSlots() {
  const queryClient = useQueryClient();
  const [params, setParams] = useSearchParams();
  const areaId = params.get('area') ?? '';
  const status = params.get('status') ?? '';
  const [form, setForm] = useState<{ slot: Slot | null } | null>(null);
  const [deleting, setDeleting] = useState<Slot | null>(null);

  const areas = useQuery({ queryKey: ['admin', 'areas'], queryFn: () => api.areas({ includeInactive: true }) });
  const slots = useQuery({ queryKey: ['admin', 'slots', areaId || 'all'], queryFn: () => api.admin.slots(areaId || undefined) });
  const refresh = () => { for (const key of ['admin', 'slots', 'areas', 'area']) void queryClient.invalidateQueries({ queryKey: [key] }); };
  const setStatus = useMutation({
    mutationFn: ({ id, next }: { id: string; next: Exclude<SlotStatus, 'RESERVED'> }) => api.setSlotStatus(id, next),
    onSuccess: (s, { next }) => { refresh(); if (s.status !== next) toast(`Slot ${s.slotNumber} stays ${s.status.toLowerCase()}: it has a current booking.`, { icon: 'ℹ️' }); else toast.success(`Slot ${s.slotNumber} marked ${s.status.toLowerCase()}`); },
    onError: (e) => toast.error(e.message),
  });
  const remove = useMutation({ mutationFn: (id: string) => api.deleteSlot(id), onSuccess: () => { refresh(); setDeleting(null); toast.success('Slot deleted'); }, onError: (e) => { setDeleting(null); toast.error(e.message); } });

  const set = (key: string, value: string) => setParams((p) => { const n = new URLSearchParams(p); if (value) n.set(key, value); else n.delete(key); return n; }, { replace: true });
  const rows = slots.data?.filter((s) => !status || s.status === status);

  return (
    <>
      <PageHeader title="Slots" subtitle="Add and edit parking slots, and mark them available, occupied or under maintenance." action={<Button icon={Plus} onClick={() => setForm({ slot: null })}>Add slot</Button>} />
      <div className="mb-4 flex flex-wrap gap-3">
        <select className="field w-auto min-w-56" aria-label="Filter by parking area" value={areaId} onChange={(e) => set('area', e.target.value)}>
          <option value="">All parking areas</option>
          {areas.data?.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
        </select>
        <select className="field w-auto" aria-label="Filter by status" value={status} onChange={(e) => set('status', e.target.value)}>
          <option value="">Any status</option>
          {['AVAILABLE', 'RESERVED', 'OCCUPIED', 'MAINTENANCE'].map((s) => <option key={s} value={s}>{titleCase(s)}</option>)}
        </select>
        {rows && <p className="self-center text-sm text-slate-500">{rows.length} slot{rows.length === 1 ? '' : 's'}</p>}
      </div>

      {slots.error ? <ErrorState message={slots.error.message} onRetry={() => slots.refetch()} />
        : !rows ? <SkeletonRows rows={8} className="h-12" />
        : rows.length === 0 ? <EmptyState title="No slots match" message="Change the filters or add a slot." />
        : (
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Slot</th><th>Parking area</th><th>Level</th><th>Type</th><th>Price / hour</th><th>Status</th><th>Set status</th><th className="text-right">Actions</th></tr></thead>
              <tbody>
                {rows.map((s) => (
                  <tr key={s.id}>
                    <td className="font-mono font-bold text-ink-900">{s.slotNumber}</td>
                    <td>{s.areaName}</td>
                    <td>{s.floor}</td>
                    <td><span className="inline-flex items-center gap-1.5"><VehicleIcon type={s.vehicleType} />{vehicleLabel[s.vehicleType]}{s.isEv && <Zap className="size-3.5 text-violet-600" aria-label="EV charger" />}</span></td>
                    <td>{money(s.price)}{s.customPrice !== null && <span className="ml-1 text-xs text-slate-500">(custom)</span>}</td>
                    <td><StatusBadge status={s.status} /></td>
                    <td>
                      <select className="field h-8 w-36 py-0 text-xs" aria-label={`Set status of ${s.slotNumber}`} value={s.status === 'RESERVED' ? '' : s.status} disabled={setStatus.isPending && setStatus.variables?.id === s.id}
                        onChange={(e) => setStatus.mutate({ id: s.id, next: e.target.value as Exclude<SlotStatus, 'RESERVED'> })}>
                        {s.status === 'RESERVED' && <option value="" disabled>Reserved (booking)</option>}
                        {SETTABLE.map((v) => <option key={v} value={v}>{titleCase(v)}</option>)}
                      </select>
                    </td>
                    <td>
                      <div className="flex justify-end gap-1">
                        <Button size="sm" variant="ghost" icon={Pencil} onClick={() => setForm({ slot: s })} aria-label={`Edit slot ${s.slotNumber}`}>Edit</Button>
                        <Button size="sm" variant="ghost" icon={Trash2} className="!text-red-600 hover:!bg-red-50" onClick={() => setDeleting(s)} aria-label={`Delete slot ${s.slotNumber}`}>Delete</Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

      <SlotFormModal open={!!form} slot={form?.slot} areas={areaId ? (areas.data ?? []).filter((a) => a.id === areaId) : (areas.data ?? [])} onClose={() => setForm(null)} />
      <ConfirmDialog open={!!deleting} danger title="Delete this slot?" confirmLabel="Delete slot" loading={remove.isPending} onClose={() => setDeleting(null)} onConfirm={() => deleting && remove.mutate(deleting.id)}
        message={<>Slot <b className="font-mono">{deleting?.slotNumber}</b> at {deleting?.areaName} will be removed permanently. Slots that have booking history cannot be deleted; mark those as under maintenance instead.</>} />
    </>
  );
}
