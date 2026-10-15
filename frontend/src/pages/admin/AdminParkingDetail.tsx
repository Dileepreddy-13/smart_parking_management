import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Pencil, Plus, Save } from 'lucide-react';
import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { useParams } from 'react-router-dom';
import { api } from '../../api';
import { Alert, Badge, Button, Card, CardHeader, ErrorState, Modal, PageHeader, Skeleton, StatusBadge } from '../../components/ui';
import { AreaForm } from '../../features/admin/AreaForm';
import { SlotFormModal } from '../../features/admin/SlotForm';
import { liveVisual, SlotGrid, SlotLegend } from '../../features/parking/SlotGrid';
import { VEHICLE_TYPES, VehicleIcon } from '../../features/parking/vehicle';
import type { OperatingHour, ParkingArea, Slot, VehicleType } from '../../types';
import { DAY_NAMES, vehicleLabel } from '../../utils/format';

function RatesCard({ area, onSaved }: { area: ParkingArea; onSaved: () => void }) {
  const initial = () => Object.fromEntries(VEHICLE_TYPES.map((t) => [t, area.rates.find((r) => r.vehicleType === t)?.hourlyRate.toString() ?? ''])) as Record<VehicleType, string>;
  const [rates, setRates] = useState(initial);
  useEffect(() => setRates(initial()), [area.updatedAt]); // eslint-disable-line react-hooks/exhaustive-deps
  const parsed = VEHICLE_TYPES.filter((t) => rates[t].trim() !== '').map((t) => ({ vehicleType: t, hourlyRate: Number(rates[t]) }));
  const invalid = parsed.length === 0 || parsed.some((r) => !(r.hourlyRate > 0));
  const save = useMutation({ mutationFn: () => api.setRates(area.id, parsed), onSuccess: () => { onSaved(); toast.success('Rates updated'); } });
  return (
    <Card>
      <CardHeader title="Parking rates" subtitle="Price per hour by vehicle type. A slot can override it." />
      <div className="space-y-3 p-5">
        {save.error && <Alert tone="red">{save.error.message}</Alert>}
        {VEHICLE_TYPES.map((t) => (
          <label key={t} className="flex items-center gap-3">
            <span className="flex w-28 items-center gap-2 text-sm font-medium text-slate-700"><VehicleIcon type={t} />{vehicleLabel[t]}</span>
            <span className="relative flex-1">
              <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm text-slate-400">₹</span>
              <input className="field pl-7" inputMode="decimal" placeholder="Not offered" aria-label={`${vehicleLabel[t]} rate per hour`} value={rates[t]} onChange={(e) => setRates({ ...rates, [t]: e.target.value })} />
            </span>
            <span className="text-xs text-slate-500">/ hour</span>
          </label>
        ))}
        <Button icon={Save} disabled={invalid} loading={save.isPending} onClick={() => save.mutate()}>Save rates</Button>
      </div>
    </Card>
  );
}

function HoursCard({ area, onSaved }: { area: ParkingArea; onSaved: () => void }) {
  const [hours, setHours] = useState<OperatingHour[]>(area.operatingHours);
  const [is24x7, setIs24x7] = useState(area.is24x7);
  useEffect(() => { setHours(area.operatingHours); setIs24x7(area.is24x7); }, [area.updatedAt]); // eslint-disable-line react-hooks/exhaustive-deps
  const patch = (day: number, change: Partial<OperatingHour>) => setHours((h) => h.map((x) => (x.dayOfWeek === day ? { ...x, ...change } : x)));
  const invalid = hours.some((h) => !h.isClosed && h.openTime >= h.closeTime);
  const save = useMutation({ mutationFn: () => api.setHours(area.id, { is24x7, operatingHours: hours }), onSuccess: () => { onSaved(); toast.success('Operating hours updated'); } });
  return (
    <Card>
      <CardHeader title="Operating hours" subtitle="Bookings must fall inside these hours." />
      <div className="space-y-3 p-5">
        {save.error && <Alert tone="red">{save.error.message}</Alert>}
        <label className="flex items-center gap-2 text-sm font-semibold text-slate-700"><input type="checkbox" className="size-4 accent-brand-600" checked={is24x7} onChange={(e) => setIs24x7(e.target.checked)} /> Open 24 hours, every day</label>
        <div className={is24x7 ? 'pointer-events-none space-y-2 opacity-40' : 'space-y-2'} aria-disabled={is24x7}>
          {hours.map((h) => (
            <div key={h.dayOfWeek} className="grid grid-cols-[5.5rem_1fr_1fr_auto] items-center gap-2 text-sm">
              <span className="font-medium text-slate-700">{DAY_NAMES[h.dayOfWeek]}</span>
              <input type="time" className="field" aria-label={`${DAY_NAMES[h.dayOfWeek]} opening time`} value={h.openTime} disabled={h.isClosed} onChange={(e) => patch(h.dayOfWeek, { openTime: e.target.value })} />
              <input type="time" className="field" aria-label={`${DAY_NAMES[h.dayOfWeek]} closing time`} value={h.closeTime} disabled={h.isClosed} onChange={(e) => patch(h.dayOfWeek, { closeTime: e.target.value })} />
              <label className="flex items-center gap-1.5 text-xs text-slate-600"><input type="checkbox" className="accent-brand-600" checked={h.isClosed} onChange={(e) => patch(h.dayOfWeek, { isClosed: e.target.checked })} />Closed</label>
            </div>
          ))}
        </div>
        {invalid && !is24x7 && <p className="field-error">Closing time must be after opening time.</p>}
        <Button icon={Save} disabled={invalid && !is24x7} loading={save.isPending} onClick={() => save.mutate()}>Save hours</Button>
      </div>
    </Card>
  );
}

export function AdminParkingDetail() {
  const { id = '' } = useParams();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [slotModal, setSlotModal] = useState<{ slot: Slot | null } | null>(null);
  const area = useQuery({ queryKey: ['admin', 'area', id], queryFn: () => api.area(id) });
  const slots = useQuery({ queryKey: ['admin', 'slots', id], queryFn: () => api.admin.slots(id) });
  const refresh = () => { void queryClient.invalidateQueries({ queryKey: ['admin'] }); void queryClient.invalidateQueries({ queryKey: ['areas'] }); void queryClient.invalidateQueries({ queryKey: ['area', id] }); };
  const update = useMutation({ mutationFn: (v: Parameters<typeof api.updateArea>[1]) => api.updateArea(id, v), onSuccess: () => { refresh(); setEditing(false); toast.success('Parking area updated'); } });

  if (area.error) return <ErrorState message={area.error.message} onRetry={() => area.refetch()} />;
  if (!area.data) return <div className="space-y-4"><Skeleton className="h-10 w-72" /><Skeleton className="h-64" /></div>;
  const a = area.data;

  return (
    <>
      <PageHeader back="/admin/parking" title={a.name} subtitle={a.address}
        action={<><StatusBadge status={a.status} /><Badge tone="slate">{a.availableSlots} / {a.totalSlots} free</Badge><Button variant="secondary" icon={Pencil} onClick={() => setEditing(true)}>Edit details</Button></>} />
      {a.status === 'INACTIVE' && <div className="mb-5"><Alert tone="amber">This parking area is deactivated: customers cannot see or book it.</Alert></div>}

      <div className="grid gap-6 xl:grid-cols-2">
        <RatesCard area={a} onSaved={refresh} />
        <HoursCard area={a} onSaved={refresh} />
      </div>

      <Card className="mt-6">
        <CardHeader title={`Slots (${slots.data?.length ?? '…'})`} subtitle="Click a slot to edit it. Live status is changed on the Occupancy page." action={<Button icon={Plus} onClick={() => setSlotModal({ slot: null })}>Add slot</Button>} />
        <div className="space-y-4 p-5">
          {slots.error ? <ErrorState message={slots.error.message} />
            : !slots.data ? <Skeleton className="h-40" />
            : slots.data.length === 0 ? <Alert>No slots yet. Add the first one so customers can book here.</Alert>
            : <SlotGrid slots={slots.data} visual={liveVisual} allClickable onSelect={(slot) => setSlotModal({ slot })} />}
          <SlotLegend />
        </div>
      </Card>

      <Modal open={editing} onClose={() => setEditing(false)} title="Edit parking area" size="lg">
        <AreaForm area={a} saving={update.isPending} error={update.error?.message} onSubmit={(v) => update.mutate(v)} onCancel={() => setEditing(false)} />
      </Modal>
      <SlotFormModal open={!!slotModal} slot={slotModal?.slot} areas={[a]} onClose={() => setSlotModal(null)} />
    </>
  );
}
