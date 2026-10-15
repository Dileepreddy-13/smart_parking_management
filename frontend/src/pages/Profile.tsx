import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { KeyRound, Plus, Save, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import { z } from 'zod';
import { api } from '../api';
import { Alert, Badge, Button, Card, CardHeader, ConfirmDialog, Input, PageHeader, Select, SkeletonRows } from '../components/ui';
import { VEHICLE_TYPES, VehicleIcon } from '../features/parking/vehicle';
import { useAuth } from '../contexts/AuthContext';
import type { Vehicle } from '../types';
import { formatDate, vehicleLabel } from '../utils/format';

const profileSchema = z.object({
  name: z.string().trim().min(2, 'Enter your full name').max(100),
  phone: z.string().trim().regex(/^(\+?[0-9 -]{7,15})?$/, 'Enter a valid phone number'),
});
const passwordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Enter your current password'),
    newPassword: z.string().min(8, 'At least 8 characters').regex(/[A-Za-z]/, 'Include a letter').regex(/\d/, 'Include a number'),
    confirm: z.string(),
  })
  .refine((v) => v.newPassword === v.confirm, { path: ['confirm'], message: 'Passwords do not match' });
const vehicleSchema = z.object({
  vehicleNumber: z.string().trim().regex(/^[A-Za-z0-9 -]{4,15}$/, 'Enter a valid registration number'),
  vehicleType: z.enum(['CAR', 'BIKE', 'EV']),
});

function ProfileForm() {
  const { user, setUser } = useAuth();
  const { register, handleSubmit, formState: { errors, isDirty }, reset } = useForm({ resolver: zodResolver(profileSchema), defaultValues: { name: user?.name ?? '', phone: user?.phone ?? '' } });
  const save = useMutation({ mutationFn: api.updateProfile, onSuccess: (u) => { setUser(u); reset({ name: u.name, phone: u.phone ?? '' }); toast.success('Profile updated'); } });
  return (
    <Card>
      <CardHeader title="Personal details" subtitle={user ? `Member since ${formatDate(user.createdAt)}` : undefined} action={user && <Badge tone={user.role === 'ADMIN' ? 'violet' : 'blue'}>{user.role === 'ADMIN' ? 'Administrator' : 'Customer'}</Badge>} />
      <form className="space-y-4 p-5" onSubmit={handleSubmit((v) => save.mutate({ name: v.name, phone: v.phone || null }))} noValidate>
        {save.error && <Alert tone="red">{save.error.message}</Alert>}
        <div className="grid gap-4 sm:grid-cols-2">
          <Input label="Full name" autoComplete="name" error={errors.name?.message} {...register('name')} />
          <Input label="Phone" type="tel" autoComplete="tel" error={errors.phone?.message} {...register('phone')} />
        </div>
        <Input label="Email" value={user?.email ?? ''} disabled readOnly hint="Your email is your login and cannot be changed here." />
        <Button type="submit" icon={Save} loading={save.isPending} disabled={!isDirty}>Save changes</Button>
      </form>
    </Card>
  );
}

function PasswordForm() {
  const { register, handleSubmit, reset, formState: { errors } } = useForm({ resolver: zodResolver(passwordSchema), defaultValues: { currentPassword: '', newPassword: '', confirm: '' } });
  const change = useMutation({ mutationFn: api.changePassword, onSuccess: () => { reset(); toast.success('Password changed'); } });
  return (
    <Card>
      <CardHeader title="Password" />
      <form className="space-y-4 p-5" onSubmit={handleSubmit(({ currentPassword, newPassword }) => change.mutate({ currentPassword, newPassword }))} noValidate>
        {change.error && <Alert tone="red">{change.error.message}</Alert>}
        <Input label="Current password" type="password" autoComplete="current-password" error={errors.currentPassword?.message} {...register('currentPassword')} />
        <div className="grid gap-4 sm:grid-cols-2">
          <Input label="New password" type="password" autoComplete="new-password" error={errors.newPassword?.message} {...register('newPassword')} />
          <Input label="Confirm new password" type="password" autoComplete="new-password" error={errors.confirm?.message} {...register('confirm')} />
        </div>
        <Button type="submit" variant="secondary" icon={KeyRound} loading={change.isPending}>Change password</Button>
      </form>
    </Card>
  );
}

function Vehicles() {
  const queryClient = useQueryClient();
  const [removing, setRemoving] = useState<Vehicle | null>(null);
  const vehicles = useQuery({ queryKey: ['vehicles'], queryFn: api.vehicles });
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['vehicles'] });
  const { register, handleSubmit, reset, formState: { errors } } = useForm({ resolver: zodResolver(vehicleSchema), defaultValues: { vehicleNumber: '', vehicleType: 'CAR' as const } });
  const add = useMutation({ mutationFn: api.addVehicle, onSuccess: () => { reset(); void refresh(); toast.success('Vehicle added'); } });
  const remove = useMutation({ mutationFn: (id: string) => api.removeVehicle(id), onSuccess: () => { setRemoving(null); void refresh(); toast.success('Vehicle removed'); } });

  return (
    <Card>
      <CardHeader title="My vehicles" subtitle="Attach a vehicle to a booking so staff can recognise it." />
      <div className="p-5">
        {!vehicles.data ? <SkeletonRows rows={2} className="h-12" /> : vehicles.data.length === 0 ? <p className="rounded-lg bg-slate-50 p-4 text-center text-sm text-slate-500">No vehicles saved yet.</p> : (
          <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200">
            {vehicles.data.map((v) => (
              <li key={v.id} className="flex items-center gap-3 px-4 py-3">
                <span className="grid size-9 place-items-center rounded-lg bg-slate-100 text-slate-600"><VehicleIcon type={v.vehicleType} /></span>
                <span className="flex-1"><span className="block font-mono font-semibold text-ink-900">{v.vehicleNumber}</span><span className="text-xs text-slate-500">{vehicleLabel[v.vehicleType]}</span></span>
                <Button variant="ghost" size="sm" icon={Trash2} className="!text-red-600 hover:!bg-red-50" onClick={() => setRemoving(v)} aria-label={`Remove ${v.vehicleNumber}`}>Remove</Button>
              </li>
            ))}
          </ul>
        )}
        <form className="mt-4 grid items-start gap-3 sm:grid-cols-[1fr_10rem_auto]" onSubmit={handleSubmit((v) => add.mutate(v))} noValidate>
          <Input label="Registration number" placeholder="TS09AB1234" className="uppercase" error={errors.vehicleNumber?.message ?? add.error?.message} {...register('vehicleNumber')} />
          <Select label="Type" {...register('vehicleType')}>{VEHICLE_TYPES.map((t) => <option key={t} value={t}>{vehicleLabel[t]}</option>)}</Select>
          <Button type="submit" icon={Plus} loading={add.isPending} className="sm:mt-[1.65rem]">Add vehicle</Button>
        </form>
      </div>
      <ConfirmDialog open={!!removing} danger title="Remove this vehicle?" confirmLabel="Remove vehicle" loading={remove.isPending} onClose={() => setRemoving(null)} onConfirm={() => removing && remove.mutate(removing.id)}
        message={<>Remove <b className="font-mono">{removing?.vehicleNumber}</b> from your account? Existing bookings keep their vehicle number.</>} />
    </Card>
  );
}

export function Profile() {
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Profile" subtitle="Manage your details, vehicles and password." />
      <div className="space-y-6"><ProfileForm /><Vehicles /><PasswordForm /></div>
    </div>
  );
}
