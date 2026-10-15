import { and, asc, eq } from 'drizzle-orm';
import type { z } from 'zod';
import { db } from '../db';
import { vehicles } from '../db/schema';
import { conflict, notFound } from '../utils/errors';
import type { vehicleSchema } from '../validators';

export const listVehicles = (userId: string) =>
  db.query.vehicles.findMany({ where: eq(vehicles.userId, userId), orderBy: asc(vehicles.createdAt) });

export async function addVehicle(userId: string, input: z.infer<typeof vehicleSchema>) {
  const number = input.vehicleNumber.replace(/[\s-]/g, '');
  const dup = await db.query.vehicles.findFirst({
    where: and(eq(vehicles.userId, userId), eq(vehicles.vehicleNumber, number)),
  });
  if (dup) throw conflict('You have already added this vehicle.', 'VEHICLE_EXISTS');
  const [row] = await db.insert(vehicles).values({ userId, vehicleNumber: number, vehicleType: input.vehicleType }).returning();
  return row;
}

export async function removeVehicle(userId: string, id: string) {
  const rows = await db
    .delete(vehicles)
    .where(and(eq(vehicles.id, id), eq(vehicles.userId, userId)))
    .returning({ id: vehicles.id });
  if (rows.length === 0) throw notFound('Vehicle');
}
