import { describe, expect, it } from 'vitest';
import { vehicleFitsSlot, countSlots } from '../src/services/availability';
import { distanceKm } from '../src/utils/geo';
import { calculatePrice, refundPolicy } from '../src/utils/pricing';
import { localParts, startOfLocalDay } from '../src/utils/time';
import { registerSchema, reservationSchema } from '../src/validators';

const at = (iso: string) => new Date(iso);

describe('price calculation', () => {
  it('charges hourlyRate × hours (₹40/h × 2h = ₹80) plus tax', () => {
    const p = calculatePrice(40, at('2030-01-01T10:00:00Z'), at('2030-01-01T12:00:00Z'), 18);
    expect(p).toMatchObject({ billedHours: 2, baseAmount: 80, taxAmount: 14.4, totalAmount: 94.4 });
  });

  it('rounds the duration up to the next 30 minutes', () => {
    expect(calculatePrice(40, at('2030-01-01T10:00:00Z'), at('2030-01-01T11:10:00Z'), 0).billedHours).toBe(1.5);
    expect(calculatePrice(40, at('2030-01-01T10:00:00Z'), at('2030-01-01T10:30:00Z'), 0).baseAmount).toBe(20);
    expect(calculatePrice(40, at('2030-01-01T10:00:00Z'), at('2030-01-01T10:31:00Z'), 0).baseAmount).toBe(40);
  });

  it('works without tax and rejects a non-positive duration', () => {
    expect(calculatePrice(55, at('2030-01-01T10:00:00Z'), at('2030-01-01T13:00:00Z'), 0).totalAmount).toBe(165);
    expect(() => calculatePrice(40, at('2030-01-01T10:00:00Z'), at('2030-01-01T10:00:00Z'), 18)).toThrow();
  });
});

describe('cancellation policy', () => {
  const policy = { freeCancelMinutes: 60, lateRefundPercent: 50 };
  const now = at('2030-01-01T10:00:00Z');
  it('gives a full refund when cancelled early', () => {
    expect(refundPolicy(at('2030-01-01T12:00:00Z'), now, policy)).toMatchObject({ allowed: true, refundPercent: 100 });
  });
  it('gives a partial refund when cancelled late', () => {
    expect(refundPolicy(at('2030-01-01T10:30:00Z'), now, policy)).toMatchObject({ allowed: true, refundPercent: 50 });
  });
  it('refuses cancellation after the start time', () => {
    expect(refundPolicy(at('2030-01-01T09:59:00Z'), now, policy).allowed).toBe(false);
  });
});

describe('helpers', () => {
  it('computes occupancy as (occupied + reserved) / total', () => {
    const slots = [
      ...Array(20).fill({ status: 'AVAILABLE' }),
      ...Array(10).fill({ status: 'RESERVED' }),
      ...Array(18).fill({ status: 'OCCUPIED' }),
      ...Array(2).fill({ status: 'MAINTENANCE' }),
    ];
    expect(countSlots(slots)).toMatchObject({ total: 50, occupancyPercent: 56 });
  });

  it('matches vehicles to slot types', () => {
    expect(vehicleFitsSlot('CAR', 'CAR')).toBe(true);
    expect(vehicleFitsSlot('EV', 'CAR')).toBe(true);
    expect(vehicleFitsSlot('CAR', 'EV')).toBe(false);
    expect(vehicleFitsSlot('BIKE', 'CAR')).toBe(false);
  });

  it('measures distance between two points', () => {
    expect(distanceKm(17.392, 78.3194, 17.4474, 78.3762)).toBeGreaterThan(8);
    expect(distanceKm(17.392, 78.3194, 17.4474, 78.3762)).toBeLessThan(9);
    expect(distanceKm(17.4, 78.4, 17.4, 78.4)).toBe(0);
  });

  it('converts instants to the application timezone (IST)', () => {
    const parts = localParts(at('2030-01-01T20:00:00Z')); // 01:30 on 2 Jan in IST
    expect(parts).toEqual({ dateKey: '2030-01-02', hhmm: '01:30', dayOfWeek: 3 });
    expect(startOfLocalDay(at('2030-01-01T20:00:00Z')).toISOString()).toBe('2030-01-01T18:30:00.000Z');
  });
});

describe('validation', () => {
  it('rejects weak passwords and bad emails', () => {
    expect(registerSchema.safeParse({ name: 'A B', email: 'not-an-email', password: 'Passw0rd!' }).success).toBe(false);
    expect(registerSchema.safeParse({ name: 'A B', email: 'a@b.co', password: 'short1' }).success).toBe(false);
    expect(registerSchema.safeParse({ name: 'A B', email: 'A@B.co', password: 'Passw0rd!' }).data?.email).toBe('a@b.co');
  });
  it('requires a slot id and dates for a reservation', () => {
    expect(reservationSchema.safeParse({ slotId: 'x', startTime: 'now', endTime: 'later' }).success).toBe(false);
  });
});
