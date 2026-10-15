import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import Razorpay from 'razorpay';
import { env, razorpayEnabled } from '../config/env';
import type { Payment } from '../db/schema';

/**
 * Payment gateway adapter.
 *
 *  - RAZORPAY: real Razorpay TEST MODE, used when RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET are set.
 *  - MOCK:     built-in simulated gateway so the project runs with no external account.
 *
 * No real money moves in either mode.
 */
export const provider: 'RAZORPAY' | 'MOCK' = razorpayEnabled ? 'RAZORPAY' : 'MOCK';

let client: Razorpay | undefined;
const razorpay = () => (client ??= new Razorpay({ key_id: env.RAZORPAY_KEY_ID, key_secret: env.RAZORPAY_KEY_SECRET }));

const mockId = (prefix: string) => `${prefix}_mock_${randomBytes(7).toString('hex')}`;

export async function createGatewayOrder(amountRupees: number, receipt: string): Promise<string> {
  if (provider === 'MOCK') return mockId('order');
  const order = await razorpay().orders.create({
    amount: Math.round(amountRupees * 100), // Razorpay works in paise
    currency: 'INR',
    receipt,
  });
  return order.id;
}

/** Razorpay signs `${orderId}|${paymentId}` with the key secret; we recompute and compare. */
export function isValidSignature(orderId: string, paymentId: string, signature: string): boolean {
  const expected = createHmac('sha256', env.RAZORPAY_KEY_SECRET).update(`${orderId}|${paymentId}`).digest('hex');
  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  return a.length === b.length && timingSafeEqual(a, b);
}

export const newMockPaymentId = () => mockId('pay');

/** Best-effort refund. The refund is already recorded in our database; a gateway error is only logged. */
export async function refundOnGateway(payment: Pick<Payment, 'provider' | 'razorpayPaymentId'>, amountRupees: number) {
  if (payment.provider !== 'RAZORPAY' || !payment.razorpayPaymentId || provider !== 'RAZORPAY') return;
  try {
    await razorpay().payments.refund(payment.razorpayPaymentId, { amount: Math.round(amountRupees * 100) });
  } catch (err) {
    console.error('[payment] Razorpay refund failed:', (err as Error).message);
  }
}
