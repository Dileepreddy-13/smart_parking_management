import cron, { type ScheduledTask } from 'node-cron';
import { and, eq, inArray, lte } from 'drizzle-orm';
import { env } from '../config/env';
import { db } from '../db';
import { parkingSlots, payments, reservations } from '../db/schema';
import { syncSlotStatuses } from '../services/availability';
import { notify } from '../services/notification.service';
import { emitAdminActivity, emitSlotsChanged } from '../sockets';
import { formatDateTime } from '../utils/time';

export const REMINDER_MINUTES = 30;

/**
 * One pass of the reservation lifecycle. Runs every minute, and is exported so tests
 * (and the seed script) can run it on demand.
 *
 *   PENDING  --hold timed out--------> EXPIRED    (slot released)
 *   CONFIRMED --start time reached---> ACTIVE
 *   CONFIRMED / ACTIVE --end passed--> COMPLETED  (slot becomes AVAILABLE)
 *   CONFIRMED --30 min before start--> reminder notification
 */
export async function runLifecycle(now = new Date()) {
  const holdCutoff = new Date(now.getTime() - env.PAYMENT_HOLD_MINUTES * 60_000);

  const expired = await db
    .update(reservations)
    .set({ status: 'EXPIRED', updatedAt: now })
    .where(and(eq(reservations.status, 'PENDING'), lte(reservations.createdAt, holdCutoff)))
    .returning({ id: reservations.id });
  if (expired.length > 0)
    await db
      .update(payments)
      .set({ status: 'FAILED', failureReason: 'Reservation expired before payment', updatedAt: now })
      .where(
        and(
          inArray(
            payments.reservationId,
            expired.map((e) => e.id),
          ),
          eq(payments.status, 'PENDING'),
        ),
      );

  const completed = await db
    .update(reservations)
    .set({ status: 'COMPLETED', updatedAt: now })
    .where(and(inArray(reservations.status, ['CONFIRMED', 'ACTIVE']), lte(reservations.endTime, now)))
    .returning({ slotId: reservations.parkingSlotId });
  let releasedAreas: string[] = [];
  if (completed.length > 0) {
    // The car has left: free the bay even if it had been marked OCCUPIED during the stay.
    const released = await db
      .update(parkingSlots)
      .set({ status: 'AVAILABLE', updatedAt: now })
      .where(
        and(
          inArray(
            parkingSlots.id,
            completed.map((c) => c.slotId),
          ),
          inArray(parkingSlots.status, ['RESERVED', 'OCCUPIED']),
        ),
      )
      .returning({ areaId: parkingSlots.parkingAreaId });
    releasedAreas = released.map((r) => r.areaId);
  }

  const started = await db
    .update(reservations)
    .set({ status: 'ACTIVE', updatedAt: now })
    .where(and(eq(reservations.status, 'CONFIRMED'), lte(reservations.startTime, now)))
    .returning({ id: reservations.id });

  const dueReminders = await db
    .update(reservations)
    .set({ reminderSent: true })
    .where(
      and(
        eq(reservations.status, 'CONFIRMED'),
        eq(reservations.reminderSent, false),
        lte(reservations.startTime, new Date(now.getTime() + REMINDER_MINUTES * 60_000)),
      ),
    )
    .returning({ id: reservations.id });
  for (const { id } of dueReminders) {
    const r = await db.query.reservations.findFirst({ where: eq(reservations.id, id), with: { slot: { with: { area: true } } } });
    if (!r) continue;
    const minutes = Math.max(1, Math.round((r.startTime.getTime() - now.getTime()) / 60_000));
    await notify({
      userId: r.userId,
      type: 'BOOKING_REMINDER',
      title: 'Parking starts soon',
      message: `Your parking reservation starts in ${minutes} minutes: ${r.slot.area.name}, slot ${r.slot.slotNumber}, ${formatDateTime(r.startTime)}.`,
      reservationId: r.id,
    });
  }

  // Slot statuses follow reservations (RESERVED while a booking is running or about to start).
  const changedAreas = await syncSlotStatuses(db, { notify: false });
  emitSlotsChanged([...releasedAreas, ...changedAreas]);
  if (expired.length + completed.length + started.length > 0) emitAdminActivity('reservation');

  return { expired: expired.length, completed: completed.length, started: started.length, reminders: dueReminders.length };
}

let task: ScheduledTask | undefined;
let running = false;

export function startLifecycleJob() {
  const tick = async () => {
    if (running) return; // never overlap two passes
    running = true;
    try {
      await runLifecycle();
    } catch (err) {
      console.error('[lifecycle] job failed:', (err as Error).message);
    } finally {
      running = false;
    }
  };
  task = cron.schedule('* * * * *', tick);
  void tick();
  return task;
}

export const stopLifecycleJob = () => task?.stop();
