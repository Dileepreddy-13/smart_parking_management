import { and, eq, gt, inArray, lt, or, sql, type SQL } from 'drizzle-orm';
import { env } from '../config/env';
import type { DbOrTx } from '../db';
import { operatingHours, parkingSlots, reservations, type ParkingArea, type ParkingSlot, type VehicleType } from '../db/schema';
import { emitSlotsChanged } from '../sockets';
import { badRequest } from '../utils/errors';
import { localParts } from '../utils/time';

type Hours = typeof operatingHours.$inferSelect;

/** How long before its start time a confirmed booking shows its slot as RESERVED. */
export const RESERVED_LEAD_MINUTES = 30;

/**
 * A reservation blocks its slot when it is paid (CONFIRMED / ACTIVE) or when it is an
 * unpaid PENDING hold that has not yet timed out.
 */
export function blockingReservation(): SQL {
  const holdCutoff = new Date(Date.now() - env.PAYMENT_HOLD_MINUTES * 60_000);
  return or(
    inArray(reservations.status, ['CONFIRMED', 'ACTIVE']),
    and(eq(reservations.status, 'PENDING'), gt(reservations.createdAt, holdCutoff)),
  )!;
}

/** Two intervals overlap when each starts before the other ends. */
export const overlaps = (start: Date, end: Date): SQL =>
  and(lt(reservations.startTime, end), gt(reservations.endTime, start))!;

/** IDs of the given slots that already have a blocking reservation inside [start, end). */
export async function conflictingSlotIds(dbx: DbOrTx, slotIds: string[], start: Date, end: Date): Promise<Set<string>> {
  if (slotIds.length === 0) return new Set();
  const rows = await dbx
    .selectDistinct({ slotId: reservations.parkingSlotId })
    .from(reservations)
    .where(and(inArray(reservations.parkingSlotId, slotIds), blockingReservation(), overlaps(start, end)));
  return new Set(rows.map((r) => r.slotId));
}

/** An EV may use a regular car bay; otherwise vehicle and slot types must match. */
export const vehicleFitsSlot = (vehicle: VehicleType, slot: VehicleType) =>
  vehicle === slot || (vehicle === 'EV' && slot === 'CAR');

export function isOpenAt(area: Pick<ParkingArea, 'is24x7' | 'status'>, hours: Hours[], at: Date): boolean {
  if (area.status !== 'ACTIVE') return false;
  if (area.is24x7) return true;
  const { dayOfWeek, hhmm } = localParts(at);
  const day = hours.find((h) => h.dayOfWeek === dayOfWeek);
  return !!day && !day.isClosed && hhmm >= day.openTime && hhmm < day.closeTime;
}

/** Throws unless the whole [start, end] window falls inside the area's opening hours. */
export function assertWithinOperatingHours(area: ParkingArea, hours: Hours[], start: Date, end: Date) {
  if (area.status !== 'ACTIVE') throw badRequest('This parking area is currently unavailable.', 'PARKING_UNAVAILABLE');
  if (area.is24x7) return;
  const s = localParts(start);
  const e = localParts(end);
  const day = hours.find((h) => h.dayOfWeek === s.dayOfWeek);
  if (!day || day.isClosed) throw badRequest('The parking area is closed on the selected day.', 'PARKING_CLOSED');
  if (s.dateKey !== e.dateKey)
    throw badRequest('This parking area closes overnight, so a booking must start and end on the same day.', 'PARKING_CLOSED');
  if (s.hhmm < day.openTime || e.hhmm > day.closeTime)
    throw badRequest(`The parking area is open ${day.openTime}–${day.closeTime} on that day.`, 'PARKING_CLOSED');
}

/**
 * Keeps the live slot status in step with reservations: a slot is RESERVED while a paid
 * booking is running or about to start, and AVAILABLE otherwise. OCCUPIED and MAINTENANCE
 * are set by the administrator (or, later, by sensors) and are never overwritten here.
 */
export async function syncSlotStatuses(dbx: DbOrTx, opts: { notify?: boolean } = {}): Promise<string[]> {
  const result = await dbx.execute<{ parking_area_id: string }>(sql`
    WITH desired AS (
      SELECT s.id,
             CASE WHEN EXISTS (
               SELECT 1 FROM ${reservations} r
               WHERE r.parking_slot_id = s.id
                 AND r.status IN ('CONFIRMED', 'ACTIVE')
                 AND r.start_time <= now() + make_interval(mins => ${RESERVED_LEAD_MINUTES})
                 AND r.end_time > now()
             ) THEN 'RESERVED'::slot_status ELSE 'AVAILABLE'::slot_status END AS status
      FROM ${parkingSlots} s
      WHERE s.status IN ('AVAILABLE', 'RESERVED')
    )
    UPDATE ${parkingSlots} s
       SET status = d.status, updated_at = now()
      FROM desired d
     WHERE s.id = d.id AND s.status <> d.status
    RETURNING s.parking_area_id`);
  const areaIds = [...new Set(result.rows.map((r) => r.parking_area_id))];
  if (opts.notify !== false) emitSlotsChanged(areaIds);
  return areaIds;
}

export type SlotCounts = Record<ParkingSlot['status'], number>;
export function countSlots(slots: Array<Pick<ParkingSlot, 'status'>>) {
  const counts: SlotCounts = { AVAILABLE: 0, RESERVED: 0, OCCUPIED: 0, MAINTENANCE: 0 };
  for (const s of slots) counts[s.status] += 1;
  const total = slots.length;
  // Occupancy % = (Occupied + Reserved) / Total × 100
  const occupancyPercent = total === 0 ? 0 : Math.round(((counts.OCCUPIED + counts.RESERVED) / total) * 1000) / 10;
  return { total, counts, occupancyPercent };
}
