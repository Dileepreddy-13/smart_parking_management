import { zodResolver } from '@hookform/resolvers/zod';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useForm } from 'react-hook-form';
import { MapContainer, Marker, TileLayer, useMapEvents } from 'react-leaflet';
import { z } from 'zod';
import type { AreaInput } from '../../api';
import { Alert, Button, Input } from '../../components/ui';
import { DEFAULT_CENTER } from '../../hooks/useGeolocation';
import type { ParkingArea } from '../../types';

const schema = z.object({
  name: z.string().trim().min(3, 'At least 3 characters').max(120),
  description: z.string().trim().max(1000),
  address: z.string().trim().min(5, 'Enter the full address').max(255),
  city: z.string().trim().min(2, 'Enter a city').max(80),
  latitude: z.coerce.number({ invalid_type_error: 'Enter a number' }).min(-90).max(90),
  longitude: z.coerce.number({ invalid_type_error: 'Enter a number' }).min(-180).max(180),
  is24x7: z.boolean(),
});
type Values = z.infer<typeof schema>;

const pickerIcon = L.divIcon({ className: '', html: '<div class="map-pin map-pin--free">P</div>', iconSize: [34, 34], iconAnchor: [6, 34] });
function ClickToPlace({ onPick }: { onPick: (lat: number, lng: number) => void }) {
  useMapEvents({ click: (e) => onPick(Number(e.latlng.lat.toFixed(6)), Number(e.latlng.lng.toFixed(6))) });
  return null;
}

interface Props {
  area?: ParkingArea;
  saving: boolean;
  error?: string | null;
  onSubmit: (values: Omit<AreaInput, 'rates' | 'operatingHours' | 'status'>) => void;
  onCancel: () => void;
}

export function AreaForm({ area, saving, error, onSubmit, onCancel }: Props) {
  const { register, handleSubmit, setValue, watch, formState: { errors } } = useForm<Values>({
    resolver: zodResolver(schema) as never,
    defaultValues: area
      ? { name: area.name, description: area.description, address: area.address, city: area.city, latitude: area.latitude, longitude: area.longitude, is24x7: area.is24x7 }
      : { name: '', description: '', address: '', city: 'Hyderabad', latitude: DEFAULT_CENTER.lat, longitude: DEFAULT_CENTER.lng, is24x7: false },
  });
  const lat = Number(watch('latitude'));
  const lng = Number(watch('longitude'));
  const valid = Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180;

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
      {error && <Alert tone="red">{error}</Alert>}
      <Input label="Name" placeholder="e.g. Banjara Hills Parking" error={errors.name?.message} {...register('name')} />
      <div>
        <label htmlFor="area-description" className="field-label">Description</label>
        <textarea id="area-description" rows={2} className="field" {...register('description')} />
      </div>
      <div className="grid gap-4 sm:grid-cols-[1fr_10rem]">
        <Input label="Address" error={errors.address?.message} {...register('address')} />
        <Input label="City" error={errors.city?.message} {...register('city')} />
      </div>
      <div>
        <p className="field-label">Location <span className="font-normal text-slate-500">· click the map to place the pin</span></p>
        <MapContainer center={[valid ? lat : DEFAULT_CENTER.lat, valid ? lng : DEFAULT_CENTER.lng]} zoom={12} className="h-48 w-full border border-slate-300">
          <TileLayer attribution="&copy; OpenStreetMap contributors" url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
          <ClickToPlace onPick={(la, ln) => { setValue('latitude', la, { shouldDirty: true, shouldValidate: true }); setValue('longitude', ln, { shouldDirty: true, shouldValidate: true }); }} />
          {valid && <Marker position={[lat, lng]} icon={pickerIcon} />}
        </MapContainer>
        <div className="mt-3 grid grid-cols-2 gap-4">
          <Input label="Latitude" inputMode="decimal" error={errors.latitude?.message} {...register('latitude')} />
          <Input label="Longitude" inputMode="decimal" error={errors.longitude?.message} {...register('longitude')} />
        </div>
      </div>
      <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
        <input type="checkbox" className="size-4 accent-brand-600" {...register('is24x7')} /> Open 24 hours, every day
      </label>
      {!area && <p className="text-xs text-slate-500">Default rates (Bike ₹20, Car ₹40, EV ₹60 per hour) and hours (06:00–23:00) are applied. You can change them and add slots on the next screen.</p>}
      <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
        <Button variant="secondary" onClick={onCancel}>Cancel</Button>
        <Button type="submit" loading={saving}>{area ? 'Save changes' : 'Create parking area'}</Button>
      </div>
    </form>
  );
}
