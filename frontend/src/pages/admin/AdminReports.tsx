import { useQuery } from '@tanstack/react-query';
import { Download, IndianRupee, Printer, ReceiptText, Undo2, Wallet } from 'lucide-react';
import { useState } from 'react';
import { Bar, BarChart, CartesianGrid, Cell, ComposedChart, Legend, Line, Tooltip, XAxis, YAxis } from 'recharts';
import { api } from '../../api';
import { axisProps, CHART, ChartBox, shortDay, shortName, STATUS_COLORS, tooltipProps } from '../../components/charts';
import { Button, Card, CardHeader, ErrorState, PageHeader, Skeleton, StatCard } from '../../components/ui';
import { downloadCsv, formatDate, money, titleCase, vehicleLabel } from '../../utils/format';

const RANGES = [7, 14, 30, 90];

export function AdminReports() {
  const [days, setDays] = useState(30);
  const { data, error, refetch } = useQuery({ queryKey: ['admin', 'revenue', days], queryFn: () => api.admin.revenue(days) });
  if (error) return <ErrorState message={error.message} onRetry={() => refetch()} />;
  const totalBookings = data?.reservationsByStatus.reduce((s, r) => s + r.count, 0) ?? 0;

  return (
    <>
      <PageHeader title="Reports" subtitle={data ? `Revenue and occupancy statistics from ${formatDate(data.from)} to today` : 'Revenue and occupancy statistics'}
        action={
          <div className="flex flex-wrap gap-2 no-print">
            <select className="field w-auto" aria-label="Report period" value={days} onChange={(e) => setDays(Number(e.target.value))}>
              {RANGES.map((d) => <option key={d} value={d}>Last {d} days</option>)}
            </select>
            <Button variant="secondary" icon={Download} disabled={!data} onClick={() => data && downloadCsv(`smart-parking-report-${days}d.csv`, data.overTime.map((d) => ({ date: d.day, revenue_inr: d.revenue, reservations: d.reservations })))}>Export CSV</Button>
            <Button variant="secondary" icon={Printer} onClick={() => window.print()}>Print</Button>
          </div>
        } />

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4" aria-label="Totals">
        {!data ? Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-20" />) : (
          <>
            <StatCard label="Net revenue" value={money(data.totals.net)} icon={IndianRupee} tone="green" />
            <StatCard label="Gross collected" value={money(data.totals.gross)} icon={Wallet} tone="blue" />
            <StatCard label="Refunded" value={money(data.totals.refunds)} icon={Undo2} tone="violet" />
            <StatCard label="Paid bookings" value={data.totals.payments} icon={ReceiptText} tone="amber" hint={`${totalBookings} reservations created`} />
          </>
        )}
      </section>

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <Card className="xl:col-span-2">
          <CardHeader title="Revenue and reservations per day" />
          <div className="p-4">
            {!data ? <Skeleton className="h-72" /> : (
              <ChartBox height={300} label="Daily revenue bars with a line for reservations">
                <ComposedChart data={data.overTime.map((d) => ({ ...d, label: shortDay(d.day) }))} margin={{ top: 8, right: 0, left: -4, bottom: 0 }}>
                  <CartesianGrid vertical={false} stroke={CHART.grid} />
                  <XAxis dataKey="label" {...axisProps} minTickGap={28} />
                  <YAxis yAxisId="left" {...axisProps} axisLine={false} tickFormatter={(v) => `₹${v}`} />
                  <YAxis yAxisId="right" orientation="right" allowDecimals={false} {...axisProps} axisLine={false} />
                  <Tooltip {...tooltipProps} formatter={(v, name) => (name === 'Revenue' ? money(Number(v)) : v)} />
                  <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
                  <Bar isAnimationActive={false} yAxisId="left" dataKey="revenue" name="Revenue" fill={CHART.brand} radius={[4, 4, 0, 0]} maxBarSize={26} />
                  <Line isAnimationActive={false} yAxisId="right" type="linear" dataKey="reservations" name="Reservations" stroke={CHART.accent} strokeWidth={2.5} dot={false} />
                </ComposedChart>
              </ChartBox>
            )}
          </div>
        </Card>

        <Card>
          <CardHeader title="Revenue by parking area" />
          {!data ? <div className="p-4"><Skeleton className="h-56" /></div> : data.byArea.length === 0 ? <p className="p-10 text-center text-sm text-slate-500">No paid bookings in this period.</p> : (
            <>
              <div className="p-4">
                <ChartBox height={Math.max(160, data.byArea.length * 44)} label="Horizontal bar chart of revenue by parking area">
                  <BarChart layout="vertical" data={data.byArea.map((a) => ({ ...a, label: shortName(a.name) }))} margin={{ top: 0, right: 24, left: 8, bottom: 0 }}>
                    <CartesianGrid horizontal={false} stroke={CHART.grid} />
                    <XAxis type="number" {...axisProps} tickFormatter={(v) => `₹${v}`} />
                    <YAxis type="category" dataKey="label" width={104} {...axisProps} axisLine={false} />
                    <Tooltip {...tooltipProps} formatter={(v) => [money(Number(v)), 'Revenue']} />
                    <Bar isAnimationActive={false} dataKey="revenue" fill={CHART.brand} radius={[0, 5, 5, 0]} maxBarSize={22} />
                  </BarChart>
                </ChartBox>
              </div>
              <table className="w-full border-t border-slate-100 text-sm">
                <thead><tr className="text-left text-xs text-slate-500 uppercase"><th className="px-5 py-2 font-semibold">Area</th><th className="px-5 py-2 text-right font-semibold">Bookings</th><th className="px-5 py-2 text-right font-semibold">Revenue</th></tr></thead>
                <tbody>{data.byArea.map((a) => <tr key={a.name} className="border-t border-slate-100"><td className="px-5 py-2">{a.name}</td><td className="px-5 py-2 text-right">{a.bookings}</td><td className="px-5 py-2 text-right font-semibold">{money(a.revenue)}</td></tr>)}</tbody>
              </table>
            </>
          )}
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader title="Reservations by status" />
            <div className="p-4">
              {!data ? <Skeleton className="h-48" /> : data.reservationsByStatus.length === 0 ? <p className="p-8 text-center text-sm text-slate-500">No reservations in this period.</p> : (
                <ChartBox height={200} label="Bar chart of reservations by status">
                  <BarChart data={data.reservationsByStatus.map((r) => ({ ...r, label: titleCase(r.status) }))} margin={{ top: 8, right: 8, left: -24, bottom: 0 }}>
                    <CartesianGrid vertical={false} stroke={CHART.grid} />
                    <XAxis dataKey="label" {...axisProps} interval={0} />
                    <YAxis allowDecimals={false} {...axisProps} axisLine={false} />
                    <Tooltip {...tooltipProps} />
                    <Bar isAnimationActive={false} dataKey="count" name="Reservations" radius={[5, 5, 0, 0]} maxBarSize={44}>
                      {data.reservationsByStatus.map((r) => <Cell key={r.status} fill={STATUS_COLORS[r.status]} />)}
                    </Bar>
                  </BarChart>
                </ChartBox>
              )}
            </div>
          </Card>
          <Card>
            <CardHeader title="Revenue by vehicle type" />
            <ul className="divide-y divide-slate-100 text-sm">
              {!data ? <li className="p-4"><Skeleton className="h-16" /></li> : data.byVehicleType.length === 0 ? <li className="p-6 text-center text-slate-500">No data.</li> : data.byVehicleType.map((v) => (
                <li key={v.vehicleType} className="flex items-center justify-between px-5 py-3">
                  <span className="font-medium text-ink-900">{vehicleLabel[v.vehicleType]}</span>
                  <span className="text-slate-500">{v.bookings} booking{v.bookings === 1 ? '' : 's'}</span>
                  <span className="w-24 text-right font-semibold text-ink-900">{money(v.revenue)}</span>
                </li>
              ))}
            </ul>
          </Card>
        </div>

        <Card className="xl:col-span-2">
          <CardHeader title="Peak hours" subtitle="Number of bookings by start hour" />
          <div className="p-4">
            {!data ? <Skeleton className="h-52" /> : (
              <ChartBox height={220} label="Bar chart of bookings by hour of day">
                <BarChart data={data.peakHours.map((h) => ({ ...h, label: `${String(h.hour).padStart(2, '0')}h` }))} margin={{ top: 8, right: 8, left: -24, bottom: 0 }}>
                  <CartesianGrid vertical={false} stroke={CHART.grid} />
                  <XAxis dataKey="label" {...axisProps} interval={1} />
                  <YAxis allowDecimals={false} {...axisProps} axisLine={false} />
                  <Tooltip {...tooltipProps} />
                  <Bar isAnimationActive={false} dataKey="bookings" name="Bookings" fill={CHART.accent} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ChartBox>
            )}
          </div>
        </Card>
      </div>
    </>
  );
}
