export interface PriceBreakdown {
  billedHours: number;
  hourlyRate: number;
  baseAmount: number;
  taxPercent: number;
  taxAmount: number;
  totalAmount: number;
}

export const BILLING_STEP_MINUTES = 30;
const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

/**
 * price = hourlyRate × billedHours, where the duration is rounded UP to the next
 * 30-minute block (so 1h10m is billed as 1.5h). Tax is added on top.
 */
export function calculatePrice(hourlyRate: number, start: Date, end: Date, taxPercent: number): PriceBreakdown {
  const minutes = (end.getTime() - start.getTime()) / 60_000;
  if (!(minutes > 0)) throw new Error('End time must be after start time');
  const billedHours = (Math.ceil(minutes / BILLING_STEP_MINUTES) * BILLING_STEP_MINUTES) / 60;
  const baseAmount = round2(hourlyRate * billedHours);
  const taxAmount = round2((baseAmount * taxPercent) / 100);
  return { billedHours, hourlyRate, baseAmount, taxPercent, taxAmount, totalAmount: round2(baseAmount + taxAmount) };
}

export interface RefundDecision {
  allowed: boolean;
  refundPercent: number;
  reason: string;
}

/** Cancellation policy: full refund early, partial refund late, no cancellation once parking has started. */
export function refundPolicy(
  start: Date,
  now: Date,
  policy: { freeCancelMinutes: number; lateRefundPercent: number },
): RefundDecision {
  const minutesToStart = (start.getTime() - now.getTime()) / 60_000;
  if (minutesToStart <= 0)
    return { allowed: false, refundPercent: 0, reason: 'The reservation has already started and can no longer be cancelled.' };
  if (minutesToStart >= policy.freeCancelMinutes)
    return { allowed: true, refundPercent: 100, reason: `Free cancellation: full refund up to ${policy.freeCancelMinutes} minutes before the start time.` };
  return {
    allowed: true,
    refundPercent: policy.lateRefundPercent,
    reason: `Less than ${policy.freeCancelMinutes} minutes to the start time, so ${policy.lateRefundPercent}% is refunded on cancellation.`,
  };
}

export const roundMoney = round2;
