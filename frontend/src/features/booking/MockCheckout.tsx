import { CreditCard, FlaskConical, Lock, Smartphone } from 'lucide-react';
import { useState } from 'react';
import { Button, cx, Modal } from '../../components/ui';
import type { PaymentOrder } from '../../types';
import { money } from '../../utils/format';

interface Props {
  order: PaymentOrder | null;
  busy: boolean;
  onResult: (outcome: 'success' | 'failure') => void;
  onClose: () => void;
}

/**
 * Stand-in for the Razorpay window, used when no Razorpay test keys are configured.
 * It is labelled as a simulation everywhere: no card details are collected or sent.
 */
export function MockCheckout({ order, busy, onResult, onClose }: Props) {
  const [method, setMethod] = useState<'upi' | 'card'>('upi');
  if (!order) return null;
  return (
    <Modal open onClose={busy ? () => undefined : onClose} title="Simulated payment gateway" size="sm">
      <div className="space-y-4">
        <div className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2.5 text-xs text-amber-900">
          <FlaskConical className="mt-0.5 size-4 shrink-0" aria-hidden />
          <p><b>Simulation mode.</b> No Razorpay keys are configured, so this screen stands in for the gateway. No real money moves and no card details are needed.</p>
        </div>
        <div className="rounded-xl bg-ink-900 p-4 text-white">
          <p className="text-xs text-slate-400">Paying Smart Parking · {order.bookingRef}</p>
          <p className="mt-1 font-display text-3xl font-bold">{money(order.amount)}</p>
          <p className="mt-2 font-mono text-[11px] text-slate-400">{order.orderId}</p>
        </div>
        <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Payment method">
          {([['upi', 'UPI', Smartphone], ['card', 'Card', CreditCard]] as const).map(([id, label, Icon]) => (
            <button key={id} type="button" role="radio" aria-checked={method === id} onClick={() => setMethod(id)}
              className={cx('flex items-center justify-center gap-2 rounded-lg border-2 py-2.5 text-sm font-semibold', method === id ? 'border-brand-600 bg-brand-50 text-brand-700' : 'border-slate-200 text-slate-600 hover:border-slate-300')}>
              <Icon className="size-4" />{label}
            </button>
          ))}
        </div>
        <p className="rounded-lg bg-slate-50 px-3 py-2 font-mono text-xs text-slate-500">{method === 'upi' ? 'success@test-upi' : '4111 1111 1111 1111 · 12/30 · 123'} <span className="font-sans">(test value, not sent anywhere)</span></p>
        <div className="space-y-2">
          <Button size="lg" className="w-full" icon={Lock} loading={busy} onClick={() => onResult('success')}>Pay {money(order.amount)}</Button>
          <Button variant="ghost" className="w-full !text-red-600 hover:!bg-red-50" disabled={busy} onClick={() => onResult('failure')}>Simulate a failed payment</Button>
        </div>
      </div>
    </Modal>
  );
}
