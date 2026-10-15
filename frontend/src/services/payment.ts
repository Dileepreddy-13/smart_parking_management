import type { VerifyInput } from '../api';
import type { PaymentOrder, User } from '../types';

/**
 * Razorpay Checkout (TEST MODE) integration. Only the public key id is ever used here;
 * the key secret stays on the server, which also verifies the payment signature.
 */
interface RazorpaySuccess {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}
interface RazorpayInstance {
  open: () => void;
  on: (event: 'payment.failed', handler: (response: { error: { description?: string; metadata?: { payment_id?: string } } }) => void) => void;
}
declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => RazorpayInstance;
  }
}

const CHECKOUT_SRC = 'https://checkout.razorpay.com/v1/checkout.js';
let loading: Promise<void> | undefined;

function loadCheckout(): Promise<void> {
  if (window.Razorpay) return Promise.resolve();
  loading ??= new Promise<void>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = CHECKOUT_SRC;
    script.onload = () => resolve();
    script.onerror = () => {
      loading = undefined;
      reject(new Error('Could not load the payment window. Check your internet connection and try again.'));
    };
    document.body.appendChild(script);
  });
  return loading;
}

export class PaymentDismissed extends Error {
  constructor() {
    super('Payment window closed before paying.');
  }
}

/** Opens Razorpay Checkout and resolves with the fields the server needs to verify the payment. */
export async function payWithRazorpay(order: PaymentOrder, reservationId: string, user: User | null): Promise<VerifyInput> {
  await loadCheckout();
  return new Promise<VerifyInput>((resolve, reject) => {
    const checkout = new window.Razorpay!({
      key: order.keyId,
      amount: order.amountInPaise,
      currency: order.currency,
      order_id: order.orderId,
      name: 'Smart Parking',
      description: `Booking ${order.bookingRef}`,
      prefill: { name: user?.name, email: user?.email, contact: user?.phone ?? undefined },
      theme: { color: '#1d4ed8' },
      handler: (r: RazorpaySuccess) =>
        resolve({ reservationId, razorpayOrderId: r.razorpay_order_id, razorpayPaymentId: r.razorpay_payment_id, razorpaySignature: r.razorpay_signature }),
      modal: { ondismiss: () => reject(new PaymentDismissed()) },
    });
    checkout.on('payment.failed', (response) =>
      resolve({ reservationId, razorpayPaymentId: response.error.metadata?.payment_id, failureReason: response.error.description ?? 'Payment failed' }),
    );
    checkout.open();
  });
}
