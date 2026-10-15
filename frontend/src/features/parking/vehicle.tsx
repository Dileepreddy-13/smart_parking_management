import { Bike, Car, Zap, type LucideIcon } from 'lucide-react';
import type { VehicleType } from '../../types';

export const VEHICLE_ICONS: Record<VehicleType, LucideIcon> = { CAR: Car, BIKE: Bike, EV: Zap };
export const VEHICLE_TYPES: VehicleType[] = ['CAR', 'BIKE', 'EV'];

export function VehicleIcon({ type, className = 'size-4' }: { type: VehicleType; className?: string }) {
  const Icon = VEHICLE_ICONS[type];
  return <Icon className={className} aria-hidden />;
}
