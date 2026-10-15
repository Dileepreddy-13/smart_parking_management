import { Check, Wrench, Zap } from 'lucide-react';
import { cx } from '../../components/ui';
import type { Slot } from '../../types';
import { VehicleIcon } from './vehicle';

export type SlotVisual = 'available' | 'reserved' | 'occupied' | 'maintenance';

/** What a customer sees for a slot in the chosen time window. */
export function customerVisual(slot: Slot): SlotVisual {
  if (slot.status === 'MAINTENANCE' || slot.unavailableReason?.startsWith('Closed')) return 'maintenance';
  if (slot.bookable) return 'available';
  return slot.unavailableReason === 'Currently occupied' ? 'occupied' : 'reserved';
}
/** The raw live status, for administrators. */
export const liveVisual = (slot: Slot): SlotVisual => slot.status.toLowerCase() as SlotVisual;

const STYLES: Record<SlotVisual, string> = {
  available: 'border-emerald-500 bg-emerald-50 text-emerald-800 hover:bg-emerald-100',
  reserved: 'border-amber-400 bg-amber-50 text-amber-800',
  occupied: 'border-red-400 bg-red-50 text-red-800',
  maintenance: 'hatch border-slate-300 bg-slate-100 text-slate-500',
};
const LABELS: Record<SlotVisual, string> = { available: 'Available', reserved: 'Reserved', occupied: 'Occupied', maintenance: 'Maintenance' };

export function SlotLegend() {
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-2 text-xs text-slate-600" aria-label="Legend">
      {(Object.keys(LABELS) as SlotVisual[]).map((v) => (
        <li key={v} className="flex items-center gap-1.5"><span className={cx('size-3.5 rounded-sm border-2', STYLES[v].split(' hover')[0])} aria-hidden />{LABELS[v]}</li>
      ))}
      <li className="flex items-center gap-1.5"><Zap className="size-3.5 text-violet-600" aria-hidden />EV charger</li>
    </ul>
  );
}

interface Props {
  slots: Slot[];
  visual: (slot: Slot) => SlotVisual;
  selectedId?: string | null;
  onSelect?: (slot: Slot) => void;
  /** When false, only "available" slots can be clicked (customer view). */
  allClickable?: boolean;
  busyId?: string | null;
}

/** The floor plan: bays grouped by level, drawn like painted parking spaces. */
export function SlotGrid({ slots, visual, selectedId, onSelect, allClickable, busyId }: Props) {
  const floors = [...new Set(slots.map((s) => s.floor))].sort();
  return (
    <div className="space-y-5">
      {floors.map((floor) => (
        <div key={floor}>
          <p className="mb-2 text-xs font-semibold tracking-widest text-slate-500 uppercase">Level {floor}</p>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(4.6rem,1fr))] gap-2">
            {slots.filter((s) => s.floor === floor).map((slot) => {
              const v = visual(slot);
              const selected = slot.id === selectedId;
              const clickable = !!onSelect && (allClickable || v === 'available');
              return (
                <button
                  key={slot.id}
                  type="button"
                  disabled={!clickable || busyId === slot.id}
                  onClick={() => onSelect?.(slot)}
                  aria-pressed={selected}
                  aria-label={`Slot ${slot.slotNumber}, ${slot.vehicleType.toLowerCase()}, ${slot.unavailableReason ?? LABELS[v]}${slot.isEv ? ', EV charger' : ''}`}
                  title={slot.unavailableReason ?? LABELS[v]}
                  data-status={v}
                  className={cx(
                    'relative flex h-[4.6rem] flex-col items-center justify-between rounded-lg border-x-2 border-t-2 border-b-0 border-dashed px-1 pt-1.5 pb-1 transition',
                    STYLES[v],
                    !clickable && 'cursor-not-allowed opacity-80',
                    selected && '!border-solid !border-brand-600 !bg-brand-600 !text-white shadow-lg ring-2 ring-brand-200',
                    busyId === slot.id && 'animate-pulse',
                  )}
                >
                  <span className="flex w-full items-center justify-between px-0.5">
                    {v === 'maintenance' ? <Wrench className="size-3.5" aria-hidden /> : <VehicleIcon type={slot.vehicleType} className="size-3.5" />}
                    {selected ? <Check className="size-3.5" aria-hidden /> : slot.isEv && <Zap className={cx('size-3.5', v === 'available' && 'text-violet-600')} aria-hidden />}
                  </span>
                  <span className="font-mono text-[13px] leading-none font-bold">{slot.slotNumber}</span>
                  <span className="text-[10px] leading-none font-medium opacity-80">{slot.price !== null ? `₹${slot.price}/h` : '—'}</span>
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
