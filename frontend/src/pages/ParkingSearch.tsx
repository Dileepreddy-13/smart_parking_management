import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { List, LocateFixed, Map as MapIcon, Search, SearchX, SlidersHorizontal } from 'lucide-react';
import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api, type AreaFilters } from '../api';
import { Alert, Button, cx, EmptyState, ErrorState, PageHeader, SkeletonRows } from '../components/ui';
import { AreaCard } from '../features/parking/AreaCard';
import { ParkingMap } from '../features/parking/ParkingMap';
import { VEHICLE_TYPES } from '../features/parking/vehicle';
import { useDebounce } from '../hooks/useDebounce';
import { useGeolocation } from '../hooks/useGeolocation';
import type { VehicleType } from '../types';
import { vehicleLabel } from '../utils/format';

type Sort = NonNullable<AreaFilters['sort']>;

export function ParkingSearch() {
  const [params, setParams] = useSearchParams();
  const [search, setSearch] = useState(params.get('q') ?? '');
  const [view, setView] = useState<'list' | 'map'>('list'); // mobile only; desktop shows both
  const [hovered, setHovered] = useState<string | null>(null);
  const geo = useGeolocation();
  const q = useDebounce(search.trim());

  const vehicleType = (params.get('type') ?? '') as VehicleType | '';
  const maxPrice = params.get('max') ? Number(params.get('max')) : '';
  const availableOnly = params.get('free') === '1';
  const sort = (params.get('sort') ?? (geo.coords ? 'distance' : 'name')) as Sort;
  const set = (key: string, value: string) =>
    setParams((prev) => { const next = new URLSearchParams(prev); if (value) next.set(key, value); else next.delete(key); return next; }, { replace: true });

  const filters: AreaFilters = { q, vehicleType, maxPrice, availableOnly, sort, lat: geo.coords?.lat, lng: geo.coords?.lng };
  const { data: areas, isPending, error, refetch, isFetching } = useQuery({
    queryKey: ['areas', filters],
    queryFn: () => api.areas(filters),
    placeholderData: keepPreviousData,
  });

  const hasFilters = Boolean(q || vehicleType || maxPrice || availableOnly);
  const clear = () => { setSearch(''); setParams({}, { replace: true }); };

  return (
    <>
      <PageHeader title="Find parking" subtitle={areas ? `${areas.length} parking area${areas.length === 1 ? '' : 's'}${hasFilters ? ' match your filters' : ' available'}` : 'Searching…'} />

      <div className="mb-5 rounded-xl border border-slate-200 bg-white p-4 shadow-card">
        <div className="grid gap-3 md:grid-cols-[1fr_auto_auto_auto]">
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-400" aria-hidden />
            <input type="search" className="field pl-9" placeholder="Search by name, area or address" aria-label="Search parking" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <select className="field md:w-40" aria-label="Vehicle type" value={vehicleType} onChange={(e) => set('type', e.target.value)}>
            <option value="">Any vehicle</option>
            {VEHICLE_TYPES.map((t) => <option key={t} value={t}>{vehicleLabel[t]}</option>)}
          </select>
          <select className="field md:w-40" aria-label="Maximum price" value={maxPrice} onChange={(e) => set('max', e.target.value)}>
            <option value="">Any price</option>
            {[20, 40, 60, 80].map((p) => <option key={p} value={p}>Up to ₹{p}/h</option>)}
          </select>
          <select className="field md:w-44" aria-label="Sort by" value={sort} onChange={(e) => set('sort', e.target.value)}>
            <option value="name">Sort: Name</option>
            <option value="price_asc">Sort: Price, low to high</option>
            <option value="price_desc">Sort: Price, high to low</option>
            <option value="availability">Sort: Most free bays</option>
            <option value="distance" disabled={!geo.coords}>Sort: Nearest{geo.coords ? '' : ' (needs location)'}</option>
          </select>
        </div>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <label className="inline-flex items-center gap-2 text-sm font-medium text-slate-700">
            <input type="checkbox" className="size-4 rounded border-slate-300 accent-brand-600" checked={availableOnly} onChange={(e) => set('free', e.target.checked ? '1' : '')} />
            Only show areas with free bays
          </label>
          <div className="flex items-center gap-3 text-xs text-slate-500">
            <span className="inline-flex items-center gap-1"><LocateFixed className="size-3.5" aria-hidden />{geo.status === 'granted' ? 'Using your location' : geo.status === 'pending' ? 'Locating…' : 'Location off: showing Hyderabad'}</span>
            {hasFilters && <button type="button" onClick={clear} className="font-semibold text-brand-600 hover:underline">Clear filters</button>}
          </div>
        </div>
      </div>

      <div className="mb-4 flex gap-1 rounded-xl bg-slate-200/60 p-1 lg:hidden" role="tablist" aria-label="View">
        {([['list', 'List', List], ['map', 'Map', MapIcon]] as const).map(([id, label, Icon]) => (
          <button key={id} type="button" role="tab" aria-selected={view === id} onClick={() => setView(id)} className={cx('flex flex-1 items-center justify-center gap-2 rounded-lg py-2 text-sm font-semibold', view === id ? 'bg-white text-ink-900 shadow-sm' : 'text-slate-600')}>
            <Icon className="size-4" />{label}
          </button>
        ))}
      </div>

      {error ? (
        <ErrorState message={error.message} onRetry={() => refetch()} />
      ) : (
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
          <section aria-label="Parking areas" className={cx('space-y-3', view === 'map' && 'hidden lg:block', isFetching && !isPending && 'opacity-70 transition-opacity')}>
            {isPending || !areas ? (
              <SkeletonRows rows={4} className="h-36" />
            ) : areas.length === 0 ? (
              <EmptyState icon={hasFilters ? SearchX : SlidersHorizontal} title="No parking areas found" message={hasFilters ? 'Nothing matches these filters. Try a different location, vehicle type or price.' : 'No parking areas have been added yet.'} action={hasFilters && <Button variant="secondary" onClick={clear}>Clear filters</Button>} />
            ) : (
              areas.map((a) => <AreaCard key={a.id} area={a} active={hovered === a.id} onHover={setHovered} />)
            )}
          </section>
          <section aria-label="Map" className={cx('lg:sticky lg:top-20 lg:self-start', view === 'list' && 'hidden lg:block')}>
            <ParkingMap areas={areas ?? []} me={geo.coords} activeId={hovered} onSelect={setHovered} className="h-[65vh] min-h-[380px] lg:h-[calc(100vh-7rem)]" />
            {geo.status === 'denied' && <div className="mt-3"><Alert>Allow location access in your browser to see distances and sort by nearest.</Alert></div>}
          </section>
        </div>
      )}
    </>
  );
}
