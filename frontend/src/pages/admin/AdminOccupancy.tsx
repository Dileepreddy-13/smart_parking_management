import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FlaskConical, Radio } from 'lucide-react';
import { useState } from 'react';
import toast from 'react-hot-toast';
import { api } from '../../api';
import { Badge, Card, CardHeader, cx, ErrorState, PageHeader, Progress, Skeleton, SkeletonRows } from '../../components/ui';
import { liveVisual, SlotGrid, SlotLegend } from '../../features/parking/SlotGrid';
import type { OccupancyRow, Slot, SlotStatus } from '../../types';
import { titleCase } from '../../utils/format';

type Settable = Exclude<SlotStatus, 'RESERVED'>;
const TOOLS: Array<{ status: Settable; hint: string; style: string }> = [
  { status: 'OCCUPIED', hint: 'A vehicle drove in', style: 'border-red-500 bg-red-50 text-red-800' },
  { status: 'AVAILABLE', hint: 'The vehicle left', style: 'border-emerald-500 bg-emerald-50 text-emerald-800' },
  { status: 'MAINTENANCE', hint: 'Bay out of service', style: 'border-slate-400 bg-slate-100 text-slate-700' },
];

function Count({ label, value, dot }: { label: string; value: number; dot: string }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="flex items-center gap-2 text-slate-600"><span className={cx('size-2.5 rounded-full', dot)} aria-hidden />{label}</span>
      <span className="font-mono font-bold text-ink-900">{value}</span>
    </div>
  );
}

function AreaCard({ row, active, onSelect }: { row: OccupancyRow; active: boolean; onSelect: () => void }) {
  return (
    <button type="button" onClick={onSelect} aria-pressed={active} className={cx('rounded-xl border bg-white p-4 text-left shadow-card transition hover:border-brand-500', active ? 'border-brand-600 ring-2 ring-brand-100' : 'border-slate-200', row.status === 'INACTIVE' && 'opacity-60')}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0"><p className="truncate font-display font-semibold text-ink-900">{row.name}</p><p className="text-xs text-slate-500">Total: {row.total} slots</p></div>
        <p className="font-display text-2xl font-bold text-ink-900">{row.occupancyPercent}<span className="text-sm">%</span></p>
      </div>
      <div className="my-3"><Progress value={row.occupancyPercent} /></div>
      <div className="space-y-1.5">
        <Count label="Available" value={row.available} dot="bg-emerald-500" />
        <Count label="Reserved" value={row.reserved} dot="bg-amber-500" />
        <Count label="Occupied" value={row.occupied} dot="bg-red-500" />
        <Count label="Maintenance" value={row.maintenance} dot="bg-slate-400" />
      </div>
    </button>
  );
}

export function AdminOccupancy() {
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<string | null>(null);
  const [tool, setTool] = useState<Settable>('OCCUPIED');
  const occupancy = useQuery({ queryKey: ['admin', 'occupancy'], queryFn: api.admin.occupancy });
  const areaId = selected ?? occupancy.data?.areas[0]?.id ?? null;
  const area = occupancy.data?.areas.find((a) => a.id === areaId);
  const slots = useQuery({ queryKey: ['admin', 'slots', areaId], queryFn: () => api.admin.slots(areaId!), enabled: !!areaId });

  const setStatus = useMutation({
    mutationFn: (slot: Slot) => api.setSlotStatus(slot.id, tool),
    onSuccess: (s) => {
      void queryClient.invalidateQueries({ queryKey: ['admin'] });
      if (s.status !== tool) toast(`${s.slotNumber} stays ${s.status.toLowerCase()}: a booking is running or about to start.`, { icon: 'ℹ️' });
    },
    onError: (e) => toast.error(e.message),
  });

  if (occupancy.error) return <ErrorState message={occupancy.error.message} onRetry={() => occupancy.refetch()} />;
  const t = occupancy.data?.totals;

  return (
    <>
      <PageHeader title="Occupancy monitoring" subtitle="Occupancy % = (Occupied + Reserved) ÷ Total × 100"
        action={<Badge tone="green"><Radio className="size-3 animate-pulse" aria-hidden />Live via Socket.IO</Badge>} />

      {!t ? <Skeleton className="h-28" /> : (
        <Card className="mb-6 p-5">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-xs font-semibold tracking-widest text-slate-500 uppercase">All parking areas</p>
              <p className="font-display text-4xl font-bold text-ink-900" data-testid="overall-occupancy">{t.occupancyPercent}%</p>
            </div>
            <dl className="flex flex-wrap gap-x-8 gap-y-2 text-sm">
              {([['Total', t.total, 'text-ink-900'], ['Available', t.AVAILABLE, 'text-emerald-700'], ['Reserved', t.RESERVED, 'text-amber-700'], ['Occupied', t.OCCUPIED, 'text-red-700'], ['Maintenance', t.MAINTENANCE, 'text-slate-600']] as const).map(([label, value, color]) => (
                <div key={label}><dt className="text-xs text-slate-500">{label}</dt><dd className={cx('font-mono text-xl font-bold', color)}>{value}</dd></div>
              ))}
            </dl>
          </div>
          <div className="mt-4"><Progress value={t.occupancyPercent} /></div>
        </Card>
      )}

      <h2 className="mb-3 text-lg font-semibold">By parking area</h2>
      {!occupancy.data ? <SkeletonRows rows={2} className="h-44" /> : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-5">
          {occupancy.data.areas.map((row) => <AreaCard key={row.id} row={row} active={row.id === areaId} onSelect={() => setSelected(row.id)} />)}
        </div>
      )}

      <Card className="mt-6 overflow-hidden border-amber-300">
        <div className="flex flex-wrap items-center gap-3 border-b border-amber-200 bg-amber-50 px-5 py-3">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-400 px-3 py-1 text-xs font-bold tracking-wide text-ink-900 uppercase"><FlaskConical className="size-3.5" aria-hidden />Simulation Mode</span>
          <p className="text-sm text-amber-900">No physical IoT sensors are connected. Slot changes below are made by you and stand in for sensor readings.</p>
        </div>
        <CardHeader title={area ? area.name : 'Select a parking area'} subtitle="Choose what happened, then click a bay. Every open screen updates instantly." />
        <div className="space-y-5 p-5">
          <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Status to apply">
            {TOOLS.map((option) => (
              <button key={option.status} type="button" role="radio" aria-checked={tool === option.status} onClick={() => setTool(option.status)}
                className={cx('rounded-lg border-2 px-4 py-2 text-left transition', tool === option.status ? option.style : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300')}>
                <span className="block text-sm font-bold">Mark {titleCase(option.status)}</span>
                <span className="block text-xs opacity-80">{option.hint}</span>
              </button>
            ))}
          </div>
          {slots.error ? <ErrorState message={slots.error.message} />
            : !slots.data ? <Skeleton className="h-40" />
            : slots.data.length === 0 ? <p className="text-sm text-slate-500">This parking area has no slots yet.</p>
            : <SlotGrid slots={slots.data} visual={liveVisual} allClickable busyId={setStatus.isPending ? setStatus.variables?.id : null} onSelect={(slot) => slot.status !== tool && setStatus.mutate(slot)} />}
          <SlotLegend />
          <p className="text-xs text-slate-500">Reserved bays are controlled by bookings. In a real deployment an IoT sensor gateway would call the same <code className="rounded bg-slate-100 px-1 font-mono">PATCH /api/slots/:id/status</code> endpoint that these buttons use.</p>
        </div>
      </Card>
    </>
  );
}
