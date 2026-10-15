import { Clock, MapPin, Navigation, Zap } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Badge, cx } from '../../components/ui';
import type { ParkingArea } from '../../types';
import { money, vehicleLabel } from '../../utils/format';
import { VehicleIcon } from './vehicle';

export function AreaCard({ area, active, onHover }: { area: ParkingArea; active?: boolean; onHover?: (id: string | null) => void }) {
  const full = area.availableSlots === 0;
  return (
    <Link
      to={`/parking/${area.id}`}
      onMouseEnter={() => onHover?.(area.id)}
      onMouseLeave={() => onHover?.(null)}
      className={cx('block rounded-xl border bg-white p-4 shadow-card transition hover:-translate-y-0.5 hover:border-brand-500 hover:shadow-lg', active ? 'border-brand-500 ring-2 ring-brand-100' : 'border-slate-200')}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate text-lg font-semibold">{area.name}</h3>
          <p className="mt-0.5 flex items-start gap-1 text-sm text-slate-500"><MapPin className="mt-0.5 size-3.5 shrink-0" aria-hidden />{area.address}</p>
        </div>
        <div className="shrink-0 text-right">
          <p className="font-display text-xl font-bold text-ink-900">{money(area.pricePerHour)}</p>
          <p className="text-xs text-slate-500">per hour</p>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Badge tone={full ? 'red' : 'green'} dot>{full ? 'Full right now' : `${area.availableSlots} of ${area.totalSlots} free`}</Badge>
        <Badge tone={area.isOpenNow ? 'slate' : 'amber'}><Clock className="size-3" aria-hidden />{area.isOpenNow ? area.todayHours : `Closed · ${area.todayHours}`}</Badge>
        {area.distanceKm !== null && <Badge tone="blue"><Navigation className="size-3" aria-hidden />{area.distanceKm} km</Badge>}
        {area.hasEvCharging && <Badge tone="violet"><Zap className="size-3" aria-hidden />EV charging</Badge>}
      </div>
      <div className="mt-3 flex items-center gap-3 border-t border-slate-100 pt-3 text-xs text-slate-500">
        {area.vehicleTypes.map((t) => <span key={t} className="inline-flex items-center gap-1"><VehicleIcon type={t} className="size-3.5" />{vehicleLabel[t]}</span>)}
      </div>
    </Link>
  );
}
