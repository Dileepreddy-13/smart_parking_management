import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import { z } from 'zod';
import { api } from '../../api';
import { Alert, Button, Input, Modal, Select } from '../../components/ui';
import type { ParkingArea, Slot } from '../../types';
import { vehicleLabel } from '../../utils/format';
import { VEHICLE_TYPES } from '../parking/vehicle';

const schema = z.object({
  parkingAreaId: z.string().min(1, 'Choose a parking area'),
  slotNumber: z.string().trim().regex(/^[A-Za-z0-9-]{1,20}$/, 'Letters, digits and dashes, e.g. A-101'),
  floor: z.string().trim().min(1, 'Required').max(20),
  vehicleType: z.enum(['CAR', 'BIKE', 'EV']),
  price: z.string().trim().regex(/^(\d+(\.\d{1,2})?)?$/, 'Enter an amount, or leave empty'),
  isEv: z.boolean(),
});
type Values = z.infer<typeof schema>;

interface Props {
  open: boolean;
  onClose: () => void;
  /** Editing when set, creating otherwise. */
  slot?: Slot | null;
  /** Areas to choose from when creating; a single entry hides the picker. */
  areas: Array<Pick<ParkingArea, 'id' | 'name'>>;
}

export function SlotFormModal({ open, onClose, slot, areas }: Props) {
  if (!open) return null;
  return <SlotFormInner key={slot?.id ?? 'new'} onClose={onClose} slot={slot} areas={areas} />;
}

function SlotFormInner({ onClose, slot, areas }: Omit<Props, 'open'>) {
  const queryClient = useQueryClient();
  const { register, handleSubmit, formState: { errors } } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: slot
      ? { parkingAreaId: slot.parkingAreaId, slotNumber: slot.slotNumber, floor: slot.floor, vehicleType: slot.vehicleType, price: slot.customPrice?.toString() ?? '', isEv: slot.isEv }
      : { parkingAreaId: areas.length === 1 ? areas[0].id : '', slotNumber: '', floor: '1', vehicleType: 'CAR', price: '', isEv: false },
  });
  const save = useMutation({
    mutationFn: ({ parkingAreaId, price, ...rest }: Values) => {
      const body = { ...rest, price: price === '' ? null : Number(price) };
      return slot ? api.updateSlot(slot.id, body) : api.createSlot(parkingAreaId, body);
    },
    onSuccess: (s) => {
      toast.success(slot ? `Slot ${s.slotNumber} updated` : `Slot ${s.slotNumber} added`);
      for (const key of ['admin', 'slots', 'areas', 'area']) void queryClient.invalidateQueries({ queryKey: [key] });
      onClose();
    },
  });

  return (
    <Modal open onClose={onClose} title={slot ? `Edit slot ${slot.slotNumber}` : 'Add a slot'} size="sm">
      <form className="space-y-4" onSubmit={handleSubmit((v) => save.mutate(v))} noValidate>
        {save.error && <Alert tone="red">{save.error.message}</Alert>}
        {!slot && areas.length > 1 && (
          <Select label="Parking area" error={errors.parkingAreaId?.message} {...register('parkingAreaId')}>
            <option value="">Choose…</option>
            {areas.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </Select>
        )}
        <div className="grid grid-cols-2 gap-4">
          <Input label="Slot number" placeholder="A-101" className="uppercase" error={errors.slotNumber?.message} {...register('slotNumber')} />
          <Input label="Floor / level" error={errors.floor?.message} {...register('floor')} />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Select label="Vehicle type" {...register('vehicleType')}>{VEHICLE_TYPES.map((t) => <option key={t} value={t}>{vehicleLabel[t]}</option>)}</Select>
          <Input label="Price per hour (₹)" inputMode="decimal" placeholder="Area rate" hint="Empty = use the area rate." error={errors.price?.message} {...register('price')} />
        </div>
        <label className="flex items-center gap-2 text-sm font-medium text-slate-700"><input type="checkbox" className="size-4 accent-brand-600" {...register('isEv')} /> Has an EV charger</label>
        <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" loading={save.isPending}>{slot ? 'Save changes' : 'Add slot'}</Button>
        </div>
      </form>
    </Modal>
  );
}
