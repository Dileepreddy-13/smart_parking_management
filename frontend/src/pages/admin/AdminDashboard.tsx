import { useQuery } from '@tanstack/react-query';
import { Activity, CalendarCheck, CircleParking, IndianRupee, ParkingSquare, SquareCheck, SquareParking, Users, Wrench, BookmarkCheck } from 'lucide-react';
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, Tooltip, XAxis, YAxis } from 'recharts';
import { api } from '../../api';
import { axisProps, CHART, ChartBox, shortDay, shortName, STATUS_COLORS, tooltipProps } from '../../components/charts';
import { ButtonLink, Card, CardHeader, ErrorState, PageHeader, Skeleton, StatCard } from '../../components/ui';
import { money, titleCase } from '../../utils/format';

export function AdminDashboard() {
  const { data, error, refetch } = useQuery({ queryKey: ['admin', 'dashboard'], queryFn: api.admin.dashboard });
  if (error) return <ErrorState message={error.message} onRetry={() => refetch()} />;
  const s = data?.stats;
  const overTime = data?.charts.overTime.map((d) => ({ ...d, label: shortDay(d.day) }));

  return (
    <>
      <PageHeader title="Dashboard" subtitle="Live overview of every parking area. Figures update as bookings and slot changes happen."
        action={<ButtonLink to="/admin/occupancy" icon={Activity}>Monitor occupancy</ButtonLink>} />

      <section aria-label="Key figures" className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        {!s ? Array.from({ length: 10 }, (_, i) => <Skeleton key={i} className="h-20" />) : (
          <>
            <StatCard label="Parking areas" value={s.totalParkingAreas} icon={ParkingSquare} tone="blue" />
            <StatCard label="Total slots" value={s.totalSlots} icon={SquareParking} tone="slate" />
            <StatCard label="Available" value={s.availableSlots} icon={SquareCheck} tone="green" />
            <StatCard label="Occupied" value={s.occupiedSlots} icon={CircleParking} tone="red" />
            <StatCard label="Reserved" value={s.reservedSlots} icon={BookmarkCheck} tone="amber" />
            <StatCard label="Maintenance" value={s.maintenanceSlots} icon={Wrench} tone="slate" />
            <StatCard label="Reservations today" value={s.todaysReservations} icon={CalendarCheck} tone="blue" hint={`${s.activeReservations} confirmed or active`} />
            <StatCard label="Revenue today" value={money(s.todaysRevenue)} icon={IndianRupee} tone="green" hint={`${money(s.totalRevenue)} all time`} />
            <StatCard label="Total users" value={s.totalUsers} icon={Users} tone="violet" />
            <StatCard label="Occupancy" value={`${s.occupancyPercent}%`} icon={Activity} tone={s.occupancyPercent >= 85 ? 'red' : s.occupancyPercent >= 60 ? 'amber' : 'green'} hint="Occupied + reserved" />
          </>
        )}
      </section>

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader title="Occupancy by parking area" subtitle="Slots by current status" />
          <div className="p-4">
            {!data ? <Skeleton className="h-72" /> : (
              <ChartBox label="Stacked bar chart of slot status per parking area">
                <BarChart maxBarSize={48} data={data.charts.occupancyByArea.map((a) => ({ ...a, label: shortName(a.name) }))} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                  <CartesianGrid vertical={false} stroke={CHART.grid} />
                  <XAxis dataKey="label" {...axisProps} interval={0} />
                  <YAxis allowDecimals={false} {...axisProps} axisLine={false} />
                  <Tooltip {...tooltipProps} />
                  <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
                  <Bar isAnimationActive={false} dataKey="occupied" name="Occupied" stackId="s" fill={CHART.occupied} />
                  <Bar isAnimationActive={false} dataKey="reserved" name="Reserved" stackId="s" fill={CHART.reserved} />
                  <Bar isAnimationActive={false} dataKey="available" name="Available" stackId="s" fill={CHART.available} />
                  <Bar isAnimationActive={false} dataKey="maintenance" name="Maintenance" stackId="s" fill={CHART.maintenance} radius={[5, 5, 0, 0]} />
                </BarChart>
              </ChartBox>
            )}
          </div>
        </Card>

        <Card>
          <CardHeader title="Slot status distribution" subtitle="All parking areas combined" />
          <div className="p-4">
            {!data ? <Skeleton className="h-72" /> : (
              <ChartBox label="Donut chart of slots by status">
                <PieChart>
                  <Pie isAnimationActive={false} data={data.charts.slotStatus.filter((d) => d.count > 0).map((d) => ({ ...d, name: titleCase(d.status) }))} dataKey="count" nameKey="name" innerRadius="55%" outerRadius="82%" paddingAngle={2}
                    label={({ name, value }) => `${name} ${value}`} labelLine={false} fontSize={12}>
                    {data.charts.slotStatus.filter((d) => d.count > 0).map((d) => <Cell key={d.status} fill={STATUS_COLORS[d.status]} stroke="#fff" strokeWidth={2} />)}
                  </Pie>
                  <Tooltip {...tooltipProps} />
                </PieChart>
              </ChartBox>
            )}
          </div>
        </Card>

        <Card>
          <CardHeader title="Revenue over time" subtitle="Net of refunds, last 14 days" />
          <div className="p-4">
            {!overTime ? <Skeleton className="h-72" /> : (
              <ChartBox label="Area chart of daily revenue">
                <AreaChart data={overTime} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
                  <defs><linearGradient id="rev" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={CHART.brand} stopOpacity={0.35} /><stop offset="100%" stopColor={CHART.brand} stopOpacity={0.02} /></linearGradient></defs>
                  <CartesianGrid vertical={false} stroke={CHART.grid} />
                  <XAxis dataKey="label" {...axisProps} minTickGap={24} />
                  <YAxis {...axisProps} axisLine={false} tickFormatter={(v) => `₹${v}`} />
                  <Tooltip {...tooltipProps} formatter={(v) => [money(Number(v)), 'Revenue']} />
                  <Area isAnimationActive={false} type="monotone" dataKey="revenue" stroke={CHART.brand} strokeWidth={2.5} fill="url(#rev)" />
                </AreaChart>
              </ChartBox>
            )}
          </div>
        </Card>

        <Card>
          <CardHeader title="Reservations over time" subtitle="Bookings made per day, last 14 days" />
          <div className="p-4">
            {!overTime ? <Skeleton className="h-72" /> : (
              <ChartBox label="Bar chart of daily reservations">
                <BarChart data={overTime} margin={{ top: 8, right: 8, left: -24, bottom: 0 }}>
                  <CartesianGrid vertical={false} stroke={CHART.grid} />
                  <XAxis dataKey="label" {...axisProps} minTickGap={24} />
                  <YAxis allowDecimals={false} {...axisProps} axisLine={false} />
                  <Tooltip {...tooltipProps} />
                  <Bar isAnimationActive={false} dataKey="reservations" name="Reservations" fill={CHART.accent} radius={[5, 5, 0, 0]} maxBarSize={28} />
                </BarChart>
              </ChartBox>
            )}
          </div>
        </Card>
      </div>
    </>
  );
}
