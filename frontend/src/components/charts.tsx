import type { ReactNode } from 'react';
import { ResponsiveContainer } from 'recharts';

/** One palette for every chart, matching the slot-status colours used across the app. */
export const CHART = {
  brand: '#1d4ed8',
  brandSoft: '#93b4ff',
  accent: '#f5bd00',
  available: '#16a34a',
  reserved: '#f59e0b',
  occupied: '#dc2626',
  maintenance: '#94a3b8',
  grid: '#e2e8f0',
  axis: '#64748b',
};
export const STATUS_COLORS: Record<string, string> = {
  AVAILABLE: CHART.available, RESERVED: CHART.reserved, OCCUPIED: CHART.occupied, MAINTENANCE: CHART.maintenance,
  CONFIRMED: CHART.brand, ACTIVE: CHART.available, COMPLETED: '#475569', CANCELLED: CHART.occupied, EXPIRED: CHART.maintenance, PENDING: CHART.reserved,
};

export const axisProps = { tick: { fontSize: 12, fill: CHART.axis }, tickLine: false, axisLine: { stroke: CHART.grid } } as const;
export const tooltipProps = {
  contentStyle: { borderRadius: 10, border: '1px solid #e2e8f0', boxShadow: '0 8px 24px -8px rgb(12 19 34 / 0.2)', fontSize: 13 },
  cursor: { fill: 'rgb(148 163 184 / 0.12)' },
} as const;

export function ChartBox({ height = 280, children, label }: { height?: number; children: ReactNode; label: string }) {
  return (
    <div style={{ height }} role="img" aria-label={label}>
      <ResponsiveContainer width="100%" height="100%">{children as React.ReactElement}</ResponsiveContainer>
    </div>
  );
}

export const shortDay = (iso: string) => new Date(`${iso}T00:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
export const shortName = (name: string) => name.replace(/\s*(Smart |Metro |Main |Central )?Parking$/i, '');
