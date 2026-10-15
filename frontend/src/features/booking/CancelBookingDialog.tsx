import { useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { api } from '../../api';
import { ConfirmDialog } from '../../components/ui';
import type { Reservation } from '../../types';
import { money } from '../../utils/format';

/** Confirms a cancellation and spells out the refund before anything is changed. */
export function CancelBookingDialog({ booking, onClose, asAdmin }: { booking: Reservation | null; onClose: () => void; asAdmin?: boolean }) {
  const queryClient = useQueryClient();
  const cancel = useMutation({
    mutationFn: (id: string) => (asAdmin ? api.admin.cancelReservation(id) : api.cancelReservation(id)),
    onSuccess: (r) => {
      toast.success(`Booking ${r.bookingRef} cancelled`);
      for (const key of ['reservations', 'reservation', 'dashboard', 'admin', 'areas', 'slots']) void queryClient.invalidateQueries({ queryKey: [key] });
      onClose();
    },
    onError: (err) => toast.error(err.message),
  });
  if (!booking) return null;
  const paid = booking.payment?.status === 'SUCCESS';
  const percent = asAdmin ? 100 : booking.cancellation.refundPercent;
  const refund = paid ? Math.round(booking.amount * percent) / 100 : 0;
  return (
    <ConfirmDialog
      open
      danger
      title="Cancel this booking?"
      confirmLabel="Cancel booking"
      loading={cancel.isPending}
      onClose={onClose}
      onConfirm={() => cancel.mutate(booking.id)}
      message={
        <>
          <p>Bay <b className="font-mono">{booking.slot.slotNumber}</b> at <b>{booking.area.name}</b> will be released for other drivers.</p>
          <p className="mt-3 rounded-lg bg-slate-50 p-3">
            {paid ? <>Refund: <b className="text-ink-900">{money(refund)}</b> ({percent}% of {money(booking.amount)}).</> : 'This booking has not been paid for, so there is nothing to refund.'}
            {!asAdmin && paid && <span className="mt-1 block text-xs text-slate-500">{booking.cancellation.note}</span>}
          </p>
        </>
      }
    />
  );
}
