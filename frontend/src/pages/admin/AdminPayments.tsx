import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { Search } from 'lucide-react';
import { useState } from 'react';
import { api } from '../../api';
import { Badge, EmptyState, ErrorState, PageHeader, Pagination, SkeletonRows, StatusBadge } from '../../components/ui';
import { useDebounce } from '../../hooks/useDebounce';
import { formatDateTime, money } from '../../utils/format';

export function AdminPayments() {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const q = useDebounce(search.trim());
  const { data, error, refetch, isPending } = useQuery({ queryKey: ['admin', 'payments', { q, status, page }], queryFn: () => api.admin.payments({ q, status, page, pageSize: 15 }), placeholderData: keepPreviousData });

  return (
    <>
      <PageHeader title="Payments" subtitle="Every payment attempt, with its gateway references and refunds." />
      <div className="mb-4 grid gap-3 sm:grid-cols-[1fr_auto]">
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-400" aria-hidden />
          <input type="search" className="field pl-9" placeholder="Search booking ID, customer, order or payment ID" aria-label="Search payments" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
        </div>
        <select className="field sm:w-44" aria-label="Filter by status" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
          <option value="">Any status</option>
          <option value="SUCCESS">Paid</option><option value="PENDING">Pending</option><option value="FAILED">Failed</option><option value="REFUNDED">Refunded</option>
        </select>
      </div>
      {error ? <ErrorState message={error.message} onRetry={() => refetch()} />
        : isPending || !data ? <SkeletonRows rows={8} className="h-12" />
        : data.items.length === 0 ? <EmptyState title="No payments found" message="Try a different search or filter." />
        : (
          <>
            <div className="table-wrap">
              <table className="table">
                <thead><tr><th>Booking ID</th><th>Customer</th><th>Amount</th><th>Refunded</th><th>Status</th><th>Gateway</th><th>Payment ID</th><th>Date</th></tr></thead>
                <tbody>
                  {data.items.map((p) => (
                    <tr key={p.id}>
                      <td className="font-mono text-xs font-bold text-ink-900">{p.reservation.bookingRef}</td>
                      <td><p className="font-medium text-ink-900">{p.user.name}</p><p className="text-xs text-slate-500">{p.user.email}</p></td>
                      <td className="font-semibold">{money(p.amount)}</td>
                      <td>{p.refundAmount !== null ? <span className="text-violet-700">{money(p.refundAmount)}</span> : '—'}</td>
                      <td><StatusBadge status={p.status} kind="payment" />{p.failureReason && <p className="mt-1 max-w-48 truncate text-xs text-slate-500" title={p.failureReason}>{p.failureReason}</p>}</td>
                      <td><Badge tone={p.provider === 'RAZORPAY' ? 'blue' : 'amber'}>{p.provider === 'RAZORPAY' ? 'Razorpay test' : 'Simulated'}</Badge></td>
                      <td className="font-mono text-xs text-slate-600">{p.razorpayPaymentId ?? p.razorpayOrderId ?? '—'}</td>
                      <td className="whitespace-nowrap text-slate-600">{formatDateTime(p.paidAt ?? p.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination page={data.page} pageSize={data.pageSize} total={data.total} onChange={setPage} />
          </>
        )}
    </>
  );
}
