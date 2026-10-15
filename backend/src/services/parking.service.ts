import { and, asc, eq, ilike, inArray, or } from 'drizzle-orm';
import type { z } from 'zod';
import { db } from '../db';
import { operatingHours, parkingAreas, parkingRates, type VehicleType } from '../db/schema';
import { emitAdminActivity, emitSlotsChanged } from '../sockets';
import { notFound } from '../utils/errors';
import { distanceKm } from '../utils/geo';
import { localParts } from '../utils/time';
import type { areaQuery, areaSchema, areaUpdateSchema, hoursBody, ratesBody } from '../validators';
import { countSlots, isOpenAt } from './availability';

type AreaWithRelations = NonNullable<Awaited<ReturnType<typeof loadAreas>>[number]>;

const loadAreas = (ids?: string[]) =>
  db.query.parkingAreas.findMany({
    where: ids ? inArray(parkingAreas.id, ids) : undefined,
    with: { slots: true, rates: true, operatingHours: { orderBy: asc(operatingHours.dayOfWeek) } },
    orderBy: asc(parkingAreas.name),
  });

function toAreaDto(area: AreaWithRelations, opts: { vehicleType?: VehicleType; lat?: number; lng?: number } = {}) {
  const { slots, rates, operatingHours: hours, ...base } = area;
  const scoped = opts.vehicleType ? slots.filter((s) => s.vehicleType === opts.vehicleType) : slots;
  const { total, counts, occupancyPercent } = countSlots(scoped);
  const rateList = rates
    .map((r) => ({ vehicleType: r.vehicleType, hourlyRate: Number(r.hourlyRate) }))
    .sort((a, b) => a.hourlyRate - b.hourlyRate);
  const typeRate = opts.vehicleType ? rateList.find((r) => r.vehicleType === opts.vehicleType) : undefined;
  const now = new Date();
  const today = hours.find((h) => h.dayOfWeek === localParts(now).dayOfWeek);

  return {
    ...base,
    rates: rateList,
    operatingHours: hours.map(({ id: _id, parkingAreaId: _a, ...h }) => h),
    /** "From" price: the selected vehicle type's rate, or the cheapest rate in the area. */
    pricePerHour: typeRate?.hourlyRate ?? rateList[0]?.hourlyRate ?? null,
    totalSlots: total,
    availableSlots: counts.AVAILABLE,
    counts,
    occupancyPercent,
    vehicleTypes: [...new Set(slots.map((s) => s.vehicleType))].sort(),
    hasEvCharging: slots.some((s) => s.isEv),
    isOpenNow: isOpenAt(area, hours, now),
    todayHours: area.is24x7 ? 'Open 24 hours' : !today || today.isClosed ? 'Closed today' : `${today.openTime} – ${today.closeTime}`,
    distanceKm:
      opts.lat !== undefined && opts.lng !== undefined
        ? Math.round(distanceKm(opts.lat, opts.lng, area.latitude, area.longitude) * 10) / 10
        : null,
  };
}
export type AreaDto = ReturnType<typeof toAreaDto>;

export async function listAreas(query: z.infer<typeof areaQuery>, isAdmin: boolean) {
  const filters = [];
  if (!(isAdmin && query.includeInactive)) filters.push(eq(parkingAreas.status, 'ACTIVE'));
  if (query.q) {
    const term = `%${query.q.replace(/[%_]/g, '\\$&')}%`;
    filters.push(or(ilike(parkingAreas.name, term), ilike(parkingAreas.address, term), ilike(parkingAreas.city, term)));
  }
  const matching = await db
    .select({ id: parkingAreas.id })
    .from(parkingAreas)
    .where(filters.length ? and(...filters) : undefined);
  if (matching.length === 0) return [];

  let areas = (await loadAreas(matching.map((m) => m.id))).map((a) => toAreaDto(a, query));

  if (query.vehicleType) areas = areas.filter((a) => a.totalSlots > 0);
  if (query.evOnly) areas = areas.filter((a) => a.hasEvCharging);
  if (query.availableOnly) areas = areas.filter((a) => a.availableSlots > 0);
  if (query.maxPrice !== undefined) areas = areas.filter((a) => a.pricePerHour !== null && a.pricePerHour <= query.maxPrice!);

  const byPrice = (a: AreaDto, b: AreaDto) => (a.pricePerHour ?? Infinity) - (b.pricePerHour ?? Infinity);
  const sorters: Record<string, (a: AreaDto, b: AreaDto) => number> = {
    price_asc: byPrice,
    price_desc: (a, b) => -byPrice(a, b),
    availability: (a, b) => b.availableSlots - a.availableSlots,
    distance: (a, b) => (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity),
    name: (a, b) => a.name.localeCompare(b.name),
  };
  return areas.sort(sorters[query.sort]);
}

export async function getArea(id: string, opts: { isAdmin?: boolean; lat?: number; lng?: number } = {}) {
  const [area] = await loadAreas([id]);
  if (!area || (area.status !== 'ACTIVE' && !opts.isAdmin)) throw notFound('Parking area');
  return toAreaDto(area, opts);
}

async function replaceRates(tx: Parameters<Parameters<typeof db.transaction>[0]>[0], areaId: string, rates: z.infer<typeof ratesBody>['rates']) {
  await tx.delete(parkingRates).where(eq(parkingRates.parkingAreaId, areaId));
  await tx.insert(parkingRates).values(rates.map((r) => ({ parkingAreaId: areaId, vehicleType: r.vehicleType, hourlyRate: r.hourlyRate.toFixed(2) })));
}
async function replaceHours(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  areaId: string,
  hours: z.infer<typeof hoursBody>['operatingHours'],
) {
  await tx.delete(operatingHours).where(eq(operatingHours.parkingAreaId, areaId));
  await tx.insert(operatingHours).values(hours.map((h) => ({ ...h, parkingAreaId: areaId })));
}

const DEFAULT_HOURS = Array.from({ length: 7 }, (_, dayOfWeek) => ({ dayOfWeek, openTime: '06:00', closeTime: '23:00', isClosed: false }));
const DEFAULT_RATES = [
  { vehicleType: 'BIKE' as const, hourlyRate: 20 },
  { vehicleType: 'CAR' as const, hourlyRate: 40 },
  { vehicleType: 'EV' as const, hourlyRate: 60 },
];

export async function createArea(input: z.infer<typeof areaSchema>) {
  const { rates, operatingHours: hours, ...fields } = input;
  const id = await db.transaction(async (tx) => {
    const [area] = await tx.insert(parkingAreas).values(fields).returning({ id: parkingAreas.id });
    await replaceRates(tx, area.id, rates ?? DEFAULT_RATES);
    await replaceHours(tx, area.id, hours ?? DEFAULT_HOURS);
    return area.id;
  });
  emitAdminActivity('parking');
  return getArea(id, { isAdmin: true });
}

export async function updateArea(id: string, input: z.infer<typeof areaUpdateSchema>) {
  const { rates, operatingHours: hours, ...fields } = input;
  await db.transaction(async (tx) => {
    const [area] = await tx
      .update(parkingAreas)
      .set({ ...fields, updatedAt: new Date() })
      .where(eq(parkingAreas.id, id))
      .returning({ id: parkingAreas.id });
    if (!area) throw notFound('Parking area');
    if (rates) await replaceRates(tx, id, rates);
    if (hours) await replaceHours(tx, id, hours);
  });
  emitSlotsChanged(id);
  return getArea(id, { isAdmin: true });
}

/** "Delete" is a soft delete: history (reservations, payments) must stay intact. */
export async function deactivateArea(id: string) {
  const [area] = await db
    .update(parkingAreas)
    .set({ status: 'INACTIVE' })
    .where(eq(parkingAreas.id, id))
    .returning({ id: parkingAreas.id });
  if (!area) throw notFound('Parking area');
  emitSlotsChanged(id);
  return getArea(id, { isAdmin: true });
}

export const setRates = (id: string, body: z.infer<typeof ratesBody>) => updateArea(id, { rates: body.rates });
export const setHours = (id: string, body: z.infer<typeof hoursBody>) =>
  updateArea(id, { operatingHours: body.operatingHours, ...(body.is24x7 !== undefined && { is24x7: body.is24x7 }) });

/** Per-area occupancy for the admin monitoring page. */
export async function occupancy() {
  const areas = await loadAreas();
  const rows = areas.map((a) => {
    const dto = toAreaDto(a);
    return {
      id: dto.id,
      name: dto.name,
      city: dto.city,
      status: dto.status,
      total: dto.totalSlots,
      available: dto.counts.AVAILABLE,
      reserved: dto.counts.RESERVED,
      occupied: dto.counts.OCCUPIED,
      maintenance: dto.counts.MAINTENANCE,
      occupancyPercent: dto.occupancyPercent,
    };
  });
  const totals = countSlots(areas.flatMap((a) => a.slots));
  return { areas: rows, totals: { total: totals.total, ...totals.counts, occupancyPercent: totals.occupancyPercent } };
}

