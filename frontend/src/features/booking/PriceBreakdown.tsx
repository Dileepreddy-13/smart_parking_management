import { formatDuration, money } from '../../utils/format';

interface Props {
  hourlyRate: number;
  billedHours: number;
  baseAmount: number;
  taxAmount: number;
  total: number;
  taxPercent?: number;
}

/** Displays amounts exactly as the server calculated them. No arithmetic happens here. */
export function PriceBreakdown({ hourlyRate, billedHours, baseAmount, taxAmount, total, taxPercent }: Props) {
  return (
    <dl className="space-y-2 text-sm">
      <div className="flex justify-between"><dt className="text-slate-500">{money(hourlyRate)} × {formatDuration(billedHours)}</dt><dd className="font-medium text-ink-900">{money(baseAmount)}</dd></div>
      <div className="flex justify-between"><dt className="text-slate-500">Taxes{taxPercent !== undefined ? ` (GST ${taxPercent}%)` : ''}</dt><dd className="font-medium text-ink-900">{money(taxAmount)}</dd></div>
      <div className="flex items-baseline justify-between border-t border-dashed border-slate-300 pt-3"><dt className="font-semibold text-ink-900">Total</dt><dd className="font-display text-2xl font-bold text-ink-900" data-testid="total-amount">{money(total)}</dd></div>
    </dl>
  );
}
