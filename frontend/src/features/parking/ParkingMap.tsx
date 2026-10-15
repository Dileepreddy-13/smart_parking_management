import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useEffect, useMemo } from 'react';
import { MapContainer, Marker, Popup, TileLayer, useMap } from 'react-leaflet';
import { Link } from 'react-router-dom';
import { DEFAULT_CENTER, type Coords } from '../../hooks/useGeolocation';
import type { ParkingArea } from '../../types';
import { money } from '../../utils/format';

type MapArea = Pick<ParkingArea, 'id' | 'name' | 'address' | 'latitude' | 'longitude' | 'availableSlots' | 'pricePerHour' | 'distanceKm' | 'isOpenNow'>;

/** A pin that shows the number of free bays, coloured by availability. */
function pin(area: MapArea, active: boolean) {
  const state = !area.isOpenNow ? 'closed' : area.availableSlots > 0 ? 'free' : 'full';
  return L.divIcon({
    className: '',
    html: `<div class="map-pin map-pin--${state}${active ? ' map-pin--active' : ''}">${area.availableSlots}</div>`,
    iconSize: [34, 34],
    iconAnchor: [6, 34],
    popupAnchor: [11, -30],
  });
}
const meIcon = L.divIcon({ className: '', html: '<div class="map-me"></div>', iconSize: [16, 16], iconAnchor: [8, 8] });

/** Re-frames the map whenever the set of visible areas (or the user's position) changes. */
function FitBounds({ areas, me }: { areas: MapArea[]; me: Coords | null }) {
  const map = useMap();
  const key = areas.map((a) => a.id).join(',');
  useEffect(() => {
    const points: Array<[number, number]> = areas.map((a) => [a.latitude, a.longitude]);
    if (points.length === 0) {
      map.setView([me?.lat ?? DEFAULT_CENTER.lat, me?.lng ?? DEFAULT_CENTER.lng], 12, { animate: false });
    } else if (points.length === 1) {
      map.setView(points[0], 15, { animate: false });
    } else {
      // No animation: navigating away mid-animation makes Leaflet throw on an unmounted map.
      map.fitBounds(L.latLngBounds(points), { padding: [40, 40], maxZoom: 15, animate: false });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, map]);
  return null;
}

interface Props {
  areas: MapArea[];
  me?: Coords | null;
  activeId?: string | null;
  onSelect?: (id: string) => void;
  /** Hide the "View details" button when the map is already on that area's page. */
  linkToDetails?: boolean;
  className?: string;
}

export function ParkingMap({ areas, me = null, activeId, onSelect, linkToDetails = true, className = 'h-[420px]' }: Props) {
  const center = useMemo<[number, number]>(() => [areas[0]?.latitude ?? DEFAULT_CENTER.lat, areas[0]?.longitude ?? DEFAULT_CENTER.lng], [areas]);
  return (
    <MapContainer center={center} zoom={12} scrollWheelZoom={false} className={`w-full border border-slate-200 ${className}`}>
      <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
      <FitBounds areas={areas} me={me} />
      {me && <Marker position={[me.lat, me.lng]} icon={meIcon} interactive={false} keyboard={false} />}
      {areas.map((a) => (
        <Marker key={a.id} position={[a.latitude, a.longitude]} icon={pin(a, a.id === activeId)} title={a.name} eventHandlers={{ click: () => onSelect?.(a.id) }}>
          <Popup>
            <div className="min-w-48">
              <p className="font-display text-base font-semibold text-ink-900">{a.name}</p>
              <p className="mt-0.5 text-xs text-slate-500">{a.address}</p>
              <dl className="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
                <div><dt className="text-slate-500">Free</dt><dd className="font-semibold text-emerald-700">{a.availableSlots}</dd></div>
                <div><dt className="text-slate-500">Per hour</dt><dd className="font-semibold text-ink-900">{money(a.pricePerHour)}</dd></div>
                <div><dt className="text-slate-500">Distance</dt><dd className="font-semibold text-ink-900">{a.distanceKm === null ? '—' : `${a.distanceKm} km`}</dd></div>
              </dl>
              {linkToDetails && <Link to={`/parking/${a.id}`} className="mt-3 block rounded-lg bg-brand-600 py-2 text-center text-sm font-semibold !text-white hover:bg-brand-700">View details</Link>}
            </div>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}
