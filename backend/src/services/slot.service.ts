import { and, asc, count, eq } from 'drizzle-orm';
import type { z } from 'zod';
import { db } from '../db';
import { parkingAreas, parkingRates, parkingSlots, reservations, type ParkingSlot } from '../db/schema';
import { emitSlotsChanged } from '../sockets';
import { badRequest, conflict, notFound } from '../utils/errors';
import type { slotQuery, slotSchema, slotStatusSchema, slotUpdateSchema } from '../validators';
import { assertWithinOperatingHours, conflictingSlotIds, RESERVED_LEAD_MINUTES, syncSlotStatuses } from './availability';
import { AppError } from '../utils/errors';

const money = (n: number | null | undefined) => (n === null || n === undefined ? null : n.toFixed(2));

async function rateMap(areaId: string) {
  const rates = await db.query.parkingRates.findMany({ where: eq(parkingRates.parkingAreaId, areaId) });
  return new Map(rates.map((r) => [r.vehicleType, Number(r.hourlyRate)]));
}

function toSlotDto(slot: ParkingSlot, areaRate: number | undefined, bookable: boolean, reason: string | null) {
  return {
    id: slot.id,
    parkingAreaId: slot.parkingAreaId,
    slotNumber: slot.slotNumber,
    floor: slot.floor,
    vehicleType: slot.vehicleType,
    status: slot.status,
    isEv: slot.isEv,
    /** Effective hourly price: the slot's own price if set, otherwise the area rate. */
    price: slot.price !== null ? Number(slot.price) : (areaRate ?? null),
    customPrice: slot.price !== null ? Number(slot.price) : null,
    bookable,
    unavailableReason: reason,
    updatedAt: slot.updatedAt,
  };
}

/**
 * Slots of an area. With a start/end window, `bookable` answers "can this slot be reserved for
 * that period?" (computed from reservations). Without one it reflects the live status.
 */
export async function listSlots(areaId: string, query: z.infer<typeof slotQuery>, isAdmin = false) {
  const area = await db.query.parkingAreas.findFirst({ where: eq(parkingAreas.id, areaId), with: { operatingHours: true } });
  if (!area || (area.status !== 'ACTIVE' && !isAdmin)) throw notFound('Parking area');
  if (query.start && query.end && query.end <= query.start) throw badRequest('End time must be after start time.', 'INVALID_TIME_RANGE');

  const slots = await db.query.parkingSlots.findMany({
    where: and(eq(parkingSlots.parkingAreaId, areaId), query.vehicleType ? eq(parkingSlots.vehicleType, query.vehicleType) : undefined),
    orderBy: [asc(parkingSlots.floor), asc(parkingSlots.slotNumber)],
  });
  const rates = await rateMap(areaId);
  const window = query.start && query.end ? { start: query.start, end: query.end } : null;
  const taken = window
    ? await conflictingSlotIds(
        db,
        slots.map((s) => s.id),
        window.start,
        window.end,
      )
    : new Set<string>();
  // Outside opening hours nothing is bookable, and every slot says why.
  let closedReason: string | null = null;
  if (window) {
    try {
      assertWithinOperatingHours(area, area.operatingHours, window.start, window.end);
    } catch (err) {
      if (!(err instanceof AppError)) throw err;
      closedReason = `Closed: ${err.message}`;
    }
  }
  const startsSoon = window ? window.start.getTime() <= Date.now() + RESERVED_LEAD_MINUTES * 60_000 : true;

  return slots.map((slot) => {
    let reason: string | null = null;
    if (slot.status === 'MAINTENANCE') reason = 'Under maintenance';
    else if (slot.price === null && !rates.has(slot.vehicleType)) reason = 'No rate configured';
    else if (closedReason) reason = closedReason;
    else if (window) {
      if (taken.has(slot.id)) reason = 'Already booked for this time';
      else if (slot.status === 'OCCUPIED' && startsSoon) reason = 'Currently occupied';
    } else if (slot.status !== 'AVAILABLE') reason = slot.status === 'OCCUPIED' ? 'Currently occupied' : 'Reserved';
    return toSlotDto(slot, rates.get(slot.vehicleType), reason === null, reason);
  });
}

export async function createSlot(areaId: string, input: z.infer<typeof slotSchema>) {
  const area = await db.query.parkingAreas.findFirst({ where: eq(parkingAreas.id, areaId), columns: { id: true } });
  if (!area) throw notFound('Parking area');
  const dup = await db.query.parkingSlots.findFirst({
    where: and(eq(parkingSlots.parkingAreaId, areaId), eq(parkingSlots.slotNumber, input.slotNumber)),
    columns: { id: true },
  });
  if (dup) throw conflict(`Slot ${input.slotNumber} already exists in this parking area.`, 'SLOT_EXISTS');

  const [slot] = await db
    .insert(parkingSlots)
    .values({ ...input, parkingAreaId: areaId, price: money(input.price), isEv: input.isEv || input.vehicleType === 'EV' })
    .returning();
  emitSlotsChanged(areaId);
  return toSlotDto(slot, (await rateMap(areaId)).get(slot.vehicleType), true, null);
}

export async function updateSlot(id: string, input: z.infer<typeof slotUpdateSchema>) {
  const existing = await db.query.parkingSlots.findFirst({ where: eq(parkingSlots.id, id) });
  if (!existing) throw notFound('Slot');
  if (input.slotNumber && input.slotNumber !== existing.slotNumber) {
    const dup = await db.query.parkingSlots.findFirst({
      where: and(eq(parkingSlots.parkingAreaId, existing.parkingAreaId), eq(parkingSlots.slotNumber, input.slotNumber)),
      columns: { id: true },
    });
    if (dup) throw conflict(`Slot ${input.slotNumber} already exists in this parking area.`, 'SLOT_EXISTS');
  }
  const { price, ...rest } = input;
  const [slot] = await db
    .update(parkingSlots)
    .set({ ...rest, ...(price !== undefined && { price: money(price) }), updatedAt: new Date() })
    .where(eq(parkingSlots.id, id))
    .returning();
  emitSlotsChanged(slot.parkingAreaId);
  return toSlotDto(slot, (await rateMap(slot.parkingAreaId)).get(slot.vehicleType), slot.status === 'AVAILABLE', null);
}

/**
 * Admin / simulation entry point for occupancy. A real deployment would call this same
 * function from an IoT sensor gateway instead of from the admin UI.
 */
export async function changeSlotStatus(id: string, input: z.infer<typeof slotStatusSchema>) {
  const [updated] = await db
    .update(parkingSlots)
    .set({ status: input.status, updatedAt: new Date() })
    .where(eq(parkingSlots.id, id))
    .returning();
  if (!updated) throw notFound('Slot');
  // Setting AVAILABLE on a slot with a running/imminent booking snaps back to RESERVED.
  await syncSlotStatuses(db, { notify: false });
  emitSlotsChanged(updated.parkingAreaId);
  const slot = (await db.query.parkingSlots.findFirst({ where: eq(parkingSlots.id, id) }))!;
  return toSlotDto(slot, (await rateMap(slot.parkingAreaId)).get(slot.vehicleType), slot.status === 'AVAILABLE', null);
}

/** A slot with booking history cannot be removed (it would orphan reservations); use MAINTENANCE instead. */
export async function deleteSlot(id: string) {
  const slot = await db.query.parkingSlots.findFirst({ where: eq(parkingSlots.id, id) });
  if (!slot) throw notFound('Slot');
  const [{ used }] = await db.select({ used: count() }).from(reservations).where(eq(reservations.parkingSlotId, id));
  if (used > 0)
    throw conflict('This slot has booking history and cannot be deleted. Mark it as under maintenance instead.', 'SLOT_IN_USE');
  await db.delete(parkingSlots).where(eq(parkingSlots.id, id));
  emitSlotsChanged(slot.parkingAreaId);
}

/** Admin: every slot across areas (optionally one area), for the slot-management table. */
export async function listAllSlots(areaId?: string) {
  const rows = await db.query.parkingSlots.findMany({
    where: areaId ? eq(parkingSlots.parkingAreaId, areaId) : undefined,
    with: { area: { columns: { id: true, name: true }, with: { rates: true } } },
    orderBy: [asc(parkingSlots.parkingAreaId), asc(parkingSlots.floor), asc(parkingSlots.slotNumber)],
  });
  return rows.map(({ area, ...slot }) => ({
    ...toSlotDto(slot, Number(area.rates.find((r) => r.vehicleType === slot.vehicleType)?.hourlyRate) || undefined, slot.status === 'AVAILABLE', null),
    areaName: area.name,
  }));
}

