import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { Ban, Eye, Search } from 'lucide-react';
import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../../api';
import { Button, EmptyState, ErrorState, Modal, PageHeader, Pagination, SkeletonRows, StatusBadge } from '../../components/ui';
import { CancelBookingDialog } from '../../features/booking/CancelBookingDialog';
import { PriceBreakdown } from '../../features/booking/PriceBreakdown';
import { useDebounce } from '../../hooks/useDebounce';
import type { Reservation } from '../../types';
import { formatDateTime, formatShortDate, formatTime, money, titleCase } from '../../utils/format';

const STATUSES = ['PENDING', 'CONFIRMED', 'ACTIVE', 'COMPLETED', 'CANCELLED', 'EXPIRED'];
const CANCELLABLE = new Set(['PENDING', 'CONFIRMED', 'ACTIVE']);

function DetailRow({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="flex justify-between gap-4 py-1.5 text-sm"><dt className="text-slate-500">{label}</dt><dd className="text-right font-medium text-ink-900">{children}</dd></div>;
}

export function AdminReservations() {
  const [params, setParams] = useSearchParams();
  const [search, setSearch] = useState(params.get('q') ?? '');
  const q = useDebounce(search.trim());
  const status = params.get('status') ?? '';
  const areaId = params.get('area') ?? '';
  const page = Number(params.get('page') ?? 1);
  const [viewing, setViewing] = useState<Reservation | null>(null);
  const [cancelling, setCancelling] = useState<Reservation | null>(null);

  const set = (key: string, value: string) => setParams((p) => { const n = new URLSearchParams(p); if (value) n.set(key, value); else n.delete(key); if (key !== 'page') n.delete('page'); return n; }, { replace: true });
  const areas = useQuery({ queryKey: ['admin', 'areas'], queryFn: () => api.areas({ includeInactive: true }) });
  const { data, error, refetch, isPending } = useQuery({
    queryKey: ['admin', 'reservations', { q, status, areaId, page }],
    queryFn: () => api.admin.reservations({ q, status, areaId, page, pageSize: 15 }),
    placeholderData: keepPreviousData,
  });

  return (
    <>
      <PageHeader title="Reservations" subtitle="Monitor active reservations and search the full reservation history." />
      <div className="mb-4 grid gap-3 md:grid-cols-[1fr_auto_auto]">
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-400" aria-hidden />
          <input type="search" className="field pl-9" placeholder="Search booking ID, customer, vehicle or slot" aria-label="Search reservations" value={search} onChange={(e) => { setSearch(e.target.value); set('page', ''); }} />
        </div>
        <select className="field md:w-44" aria-label="Filter by status" value={status} onChange={(e) => set('status', e.target.value)}>
          <option value="">Any status</option>
          {STATUSES.map((s) => <option key={s} value={s}>{s === 'PENDING' ? 'Awaiting payment' : titleCase(s)}</option>)}
        </select>
        <select className="field md:w-60" aria-label="Filter by parking area" value={areaId} onChange={(e) => set('area', e.target.value)}>
          <option value="">All parking areas</option>
          {areas.data?.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
        </select>
      </div>

      {error ? <ErrorState message={error.message} onRetry={() => refetch()} />
        : isPending || !data ? <SkeletonRows rows={8} className="h-12" />
        : data.items.length === 0 ? <EmptyState title="No reservations found" message="Try a different search or filter." />
        : (
          <>
            <div className="table-wrap">
              <table className="table">
                <thead><tr><th>Booking ID</th><th>Customer</th><th>Parking area</th><th>Slot</th><th>When</th><th>Amount</th><th>Payment</th><th>Status</th><th className="text-right">Actions</th></tr></thead>
                <tbody>
                  {data.items.map((r) => (
                    <tr key={r.id}>
                      <td className="font-mono text-xs font-bold text-ink-900">{r.bookingRef}</td>
                      <td><p className="font-medium text-ink-900">{r.user.name}</p><p className="text-xs text-slate-500">{r.user.email}</p></td>
                      <td>{r.area.name}</td>
                      <td className="font-mono font-semibold">{r.slot.slotNumber}</td>
                      <td className="whitespace-nowrap"><p>{formatShortDate(r.startTime)}</p><p className="text-xs text-slate-500">{formatTime(r.startTime)} – {formatTime(r.endTime)}</p></td>
                      <td className="font-semibold">{money(r.amount)}</td>
                      <td>{r.payment ? <StatusBadge status={r.payment.status} kind="payment" /> : <span className="text-xs text-slate-400">None</span>}</td>
                      <td><StatusBadge status={r.status} /></td>
                      <td>
                        <div className="flex justify-end gap-1">
                          <Button size="sm" variant="ghost" icon={Eye} onClick={() => setViewing(r)} aria-label={`View ${r.bookingRef}`}>View</Button>
                          {CANCELLABLE.has(r.status) && <Button size="sm" variant="ghost" icon={Ban} className="!text-red-600 hover:!bg-red-50" onClick={() => setCancelling(r)} aria-label={`Cancel ${r.bookingRef}`}>Cancel</Button>}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination page={data.page} pageSize={data.pageSize} total={data.total} onChange={(p) => set('page', String(p))} />
          </>
        )}

      <Modal open={!!viewing} onClose={() => setViewing(null)} title={`Booking ${viewing?.bookingRef ?? ''}`}
        footer={viewing && CANCELLABLE.has(viewing.status) ? <Button variant="danger" icon={Ban} onClick={() => { setCancelling(viewing); setViewing(null); }}>Cancel reservation</Button> : undefined}>
        {viewing && (
          <div className="grid gap-6 sm:grid-cols-2">
            <dl className="divide-y divide-slate-100">
              <DetailRow label="Status"><StatusBadge status={viewing.status} /></DetailRow>
              <DetailRow label="Customer">{viewing.user.name}</DetailRow>
              <DetailRow label="Email">{viewing.user.email}</DetailRow>
              <DetailRow label="Phone">{viewing.user.phone ?? '—'}</DetailRow>
              <DetailRow label="Parking area">{viewing.area.name}</DetailRow>
              <DetailRow label="Slot"><span className="font-mono">{viewing.slot.slotNumber}</span> · L{viewing.slot.floor}</DetailRow>
              <DetailRow label="Vehicle">{viewing.vehicleNumber ?? '—'}</DetailRow>
              <DetailRow label="Start">{formatDateTime(viewing.startTime)}</DetailRow>
              <DetailRow label="End">{formatDateTime(viewing.endTime)}</DetailRow>
              <DetailRow label="Booked">{formatDateTime(viewing.createdAt)}</DetailRow>
              {viewing.cancelReason && <DetailRow label="Cancellation">{viewing.cancelReason}</DetailRow>}
            </dl>
            <div>
              <PriceBreakdown hourlyRate={viewing.hourlyRate} billedHours={viewing.billedHours} baseAmount={viewing.baseAmount} taxAmount={viewing.taxAmount} total={viewing.amount} />
              <dl className="mt-4 divide-y divide-slate-100 border-t border-slate-100">
                <DetailRow label="Payment">{viewing.payment ? <StatusBadge status={viewing.payment.status} kind="payment" /> : 'Not started'}</DetailRow>
                {viewing.payment?.razorpayPaymentId && <DetailRow label="Payment ID"><span className="font-mono text-xs break-all">{viewing.payment.razorpayPaymentId}</span></DetailRow>}
                {viewing.payment?.refundAmount != null && <DetailRow label="Refunded">{money(viewing.payment.refundAmount)}</DetailRow>}
              </dl>
            </div>
          </div>
        )}
      </Modal>
      <CancelBookingDialog booking={cancelling} asAdmin onClose={() => setCancelling(null)} />
    </>
  );
}
