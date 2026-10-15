import { AlertTriangle, ChevronLeft, ChevronRight, Inbox, Loader2, X, type LucideIcon } from 'lucide-react';
import { useEffect, useId, useRef, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes } from 'react';
import { Link, type LinkProps } from 'react-router-dom';

export const cx = (...parts: Array<string | false | null | undefined>) => parts.filter(Boolean).join(' ');

// ---- Button ---------------------------------------------------------------
type Variant = 'primary' | 'accent' | 'secondary' | 'ghost' | 'danger';
type Size = 'sm' | 'md' | 'lg';
const VARIANTS: Record<Variant, string> = {
  primary: 'bg-brand-600 text-white hover:bg-brand-700 shadow-sm',
  accent: 'bg-lane-400 text-ink-900 hover:bg-lane-300 shadow-sm',
  secondary: 'bg-white text-slate-700 border border-slate-300 hover:bg-slate-50 shadow-xs',
  ghost: 'text-slate-600 hover:bg-slate-100',
  danger: 'bg-red-600 text-white hover:bg-red-700 shadow-sm',
};
const SIZES: Record<Size, string> = { sm: 'h-8 px-3 text-xs gap-1.5', md: 'h-10 px-4 text-sm gap-2', lg: 'h-12 px-6 text-base gap-2' };
const buttonClass = (variant: Variant, size: Size, className?: string) =>
  cx('inline-flex items-center justify-center rounded-lg font-semibold whitespace-nowrap transition-colors disabled:opacity-50', VARIANTS[variant], SIZES[size], className);

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  icon?: LucideIcon;
}
export function Button({ variant = 'primary', size = 'md', loading, icon: Icon, children, className, disabled, type = 'button', ...rest }: ButtonProps) {
  return (
    <button type={type} className={buttonClass(variant, size, className)} disabled={disabled || loading} {...rest}>
      {loading ? <Loader2 className="size-4 animate-spin" aria-hidden /> : Icon && <Icon className="size-4" aria-hidden />}
      {children}
    </button>
  );
}
export function ButtonLink({ variant = 'primary', size = 'md', icon: Icon, children, className, ...rest }: LinkProps & { variant?: Variant; size?: Size; icon?: LucideIcon }) {
  return (
    <Link className={buttonClass(variant, size, className)} {...rest}>
      {Icon && <Icon className="size-4" aria-hidden />}
      {children}
    </Link>
  );
}

// ---- Layout primitives ----------------------------------------------------
export function Card({ children, className, id }: { children: ReactNode; className?: string; id?: string }) {
  return <div id={id} className={cx('rounded-xl border border-slate-200 bg-white shadow-card', className)}>{children}</div>;
}
export function CardHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
      <div>
        <h2 className="text-base font-semibold">{title}</h2>
        {subtitle && <p className="mt-0.5 text-sm text-slate-500">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}
export function PageHeader({ title, subtitle, action, back }: { title: string; subtitle?: ReactNode; action?: ReactNode; back?: string }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        {back && (
          <Link to={back} className="mb-2 inline-flex items-center gap-1 text-sm font-medium text-slate-500 hover:text-brand-600">
            <ChevronLeft className="size-4" /> Back
          </Link>
        )}
        <h1 className="text-2xl font-bold sm:text-[1.7rem]">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}
      </div>
      {action && <div className="flex flex-wrap items-center gap-2">{action}</div>}
    </div>
  );
}

// ---- Badges ---------------------------------------------------------------
export type Tone = 'green' | 'amber' | 'red' | 'blue' | 'slate' | 'violet';
const TONES: Record<Tone, string> = {
  green: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
  amber: 'bg-amber-50 text-amber-800 ring-amber-600/25',
  red: 'bg-red-50 text-red-700 ring-red-600/20',
  blue: 'bg-brand-50 text-brand-700 ring-brand-600/20',
  slate: 'bg-slate-100 text-slate-600 ring-slate-500/20',
  violet: 'bg-violet-50 text-violet-700 ring-violet-600/20',
};
export function Badge({ tone = 'slate', children, dot }: { tone?: Tone; children: ReactNode; dot?: boolean }) {
  return (
    <span className={cx('inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap ring-1 ring-inset', TONES[tone])}>
      {dot && <span className="size-1.5 rounded-full bg-current" aria-hidden />}
      {children}
    </span>
  );
}
const STATUS_TONES: Record<string, Tone> = {
  AVAILABLE: 'green', RESERVED: 'amber', OCCUPIED: 'red', MAINTENANCE: 'slate',
  PENDING: 'amber', CONFIRMED: 'blue', ACTIVE: 'green', COMPLETED: 'slate', CANCELLED: 'red', EXPIRED: 'slate',
  SUCCESS: 'green', FAILED: 'red', REFUNDED: 'violet', INACTIVE: 'red',
};
const STATUS_LABELS: Record<string, string> = { PENDING: 'Awaiting payment', SUCCESS: 'Paid' };
export function StatusBadge({ status, kind }: { status: string; kind?: 'payment' }) {
  const label = kind === 'payment' && status === 'PENDING' ? 'Pending' : (STATUS_LABELS[status] ?? status.charAt(0) + status.slice(1).toLowerCase());
  return <Badge tone={STATUS_TONES[status] ?? 'slate'} dot>{label}</Badge>;
}

// ---- Feedback states ------------------------------------------------------
export function Spinner({ label = 'Loading' }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 p-10 text-sm text-slate-500" role="status">
      <Loader2 className="size-5 animate-spin" aria-hidden /> {label}…
    </div>
  );
}
export function Skeleton({ className }: { className?: string }) {
  return <div className={cx('animate-pulse rounded-lg bg-slate-200/70', className)} aria-hidden />;
}
export function SkeletonRows({ rows = 4, className = 'h-16' }: { rows?: number; className?: string }) {
  return (
    <div className="space-y-3" role="status" aria-label="Loading">
      {Array.from({ length: rows }, (_, i) => <Skeleton key={i} className={cx('w-full', className)} />)}
    </div>
  );
}
export function EmptyState({ icon: Icon = Inbox, title, message, action }: { icon?: LucideIcon; title: string; message?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center">
      <div className="grid size-12 place-items-center rounded-full bg-slate-100 text-slate-500"><Icon className="size-6" aria-hidden /></div>
      <h3 className="mt-4 text-base font-semibold">{title}</h3>
      {message && <p className="mt-1 max-w-sm text-sm text-slate-500">{message}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="flex flex-col items-center rounded-xl border border-red-200 bg-red-50 px-6 py-10 text-center" role="alert">
      <AlertTriangle className="size-8 text-red-500" aria-hidden />
      <p className="mt-3 text-sm font-medium text-red-800">{message}</p>
      {onRetry && <Button variant="secondary" size="sm" className="mt-4" onClick={onRetry}>Try again</Button>}
    </div>
  );
}
export function Alert({ tone = 'blue', children }: { tone?: 'blue' | 'amber' | 'red' | 'green'; children: ReactNode }) {
  const styles = { blue: 'border-brand-200 bg-brand-50 text-brand-700', amber: 'border-amber-200 bg-amber-50 text-amber-900', red: 'border-red-200 bg-red-50 text-red-800', green: 'border-emerald-200 bg-emerald-50 text-emerald-800' };
  return <div className={cx('rounded-lg border px-4 py-3 text-sm', styles[tone])} role={tone === 'red' ? 'alert' : 'status'}>{children}</div>;
}

// ---- Form fields ----------------------------------------------------------
interface FieldProps { label: string; error?: string; hint?: string }
export function Input({ label, error, hint, className, ref, ...rest }: FieldProps & InputHTMLAttributes<HTMLInputElement> & { ref?: React.Ref<HTMLInputElement> }) {
  const id = useId();
  return (
    <div className={className}>
      <label htmlFor={id} className="field-label">{label}</label>
      <input id={id} ref={ref} className={cx('field', error && 'border-red-400')} aria-invalid={!!error} aria-describedby={error ? `${id}-e` : undefined} {...rest} />
      {error ? <p id={`${id}-e`} className="field-error">{error}</p> : hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
    </div>
  );
}
export function Select({ label, error, className, children, ref, ...rest }: FieldProps & SelectHTMLAttributes<HTMLSelectElement> & { ref?: React.Ref<HTMLSelectElement> }) {
  const id = useId();
  return (
    <div className={className}>
      <label htmlFor={id} className="field-label">{label}</label>
      <select id={id} ref={ref} className={cx('field', error && 'border-red-400')} {...rest}>{children}</select>
      {error && <p className="field-error">{error}</p>}
    </div>
  );
}

// ---- Modal & confirm ------------------------------------------------------
export function Modal({ open, onClose, title, children, footer, size = 'md' }: { open: boolean; onClose: () => void; title: string; children: ReactNode; footer?: ReactNode; size?: 'sm' | 'md' | 'lg' }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal?.();
    if (!open && dialog.open) dialog.close?.();
  }, [open]);
  if (!open) return null;
  const width = { sm: 'max-w-md', md: 'max-w-xl', lg: 'max-w-3xl' }[size];
  return (
    <dialog
      ref={ref}
      open={typeof HTMLDialogElement === 'undefined' || !HTMLDialogElement.prototype.showModal ? true : undefined}
      onCancel={(e) => { e.preventDefault(); onClose(); }}
      onClick={(e) => e.target === ref.current && onClose()}
      aria-label={title}
      className={cx('m-auto w-[calc(100%-2rem)] rounded-2xl bg-white p-0 shadow-2xl backdrop:bg-ink-950/60 backdrop:backdrop-blur-xs', width)}
    >
      <div className="flex max-h-[88vh] flex-col">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <h2 className="text-lg font-semibold">{title}</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"><X className="size-5" /></button>
        </div>
        <div className="overflow-y-auto px-5 py-5">{children}</div>
        {footer && <div className="flex flex-wrap justify-end gap-2 border-t border-slate-100 bg-slate-50 px-5 py-3">{footer}</div>}
      </div>
    </dialog>
  );
}
export function ConfirmDialog({ open, title, message, confirmLabel = 'Confirm', danger, loading, onConfirm, onClose }: { open: boolean; title: string; message: ReactNode; confirmLabel?: string; danger?: boolean; loading?: boolean; onConfirm: () => void; onClose: () => void }) {
  return (
    <Modal open={open} onClose={onClose} title={title} size="sm" footer={<><Button variant="secondary" onClick={onClose}>Keep as is</Button><Button variant={danger ? 'danger' : 'primary'} loading={loading} onClick={onConfirm}>{confirmLabel}</Button></>}>
      <div className="text-sm leading-relaxed text-slate-600">{message}</div>
    </Modal>
  );
}

// ---- Tabs, stats, pagination ---------------------------------------------
export function Tabs<T extends string>({ tabs, value, onChange }: { tabs: Array<{ id: T; label: string; count?: number }>; value: T; onChange: (id: T) => void }) {
  return (
    <div className="flex gap-1 overflow-x-auto rounded-xl bg-slate-200/60 p-1" role="tablist">
      {tabs.map((t) => (
        <button key={t.id} type="button" role="tab" aria-selected={value === t.id} onClick={() => onChange(t.id)}
          className={cx('flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold whitespace-nowrap transition-colors', value === t.id ? 'bg-white text-ink-900 shadow-sm' : 'text-slate-600 hover:text-ink-900')}>
          {t.label}
          {t.count !== undefined && <span className={cx('rounded-full px-1.5 text-xs', value === t.id ? 'bg-brand-100 text-brand-700' : 'bg-slate-300/70 text-slate-600')}>{t.count}</span>}
        </button>
      ))}
    </div>
  );
}
export function StatCard({ label, value, icon: Icon, tone = 'blue', hint }: { label: string; value: ReactNode; icon: LucideIcon; tone?: Tone; hint?: string }) {
  const tones: Record<Tone, string> = { green: 'bg-emerald-100 text-emerald-700', amber: 'bg-amber-100 text-amber-700', red: 'bg-red-100 text-red-700', blue: 'bg-brand-100 text-brand-700', slate: 'bg-slate-100 text-slate-600', violet: 'bg-violet-100 text-violet-700' };
  return (
    <Card className="flex items-center gap-4 p-4">
      <div className={cx('grid size-11 shrink-0 place-items-center rounded-xl', tones[tone])}><Icon className="size-5" aria-hidden /></div>
      <div className="min-w-0">
        <p className="text-xs leading-tight font-medium tracking-wide text-slate-500 uppercase">{label}</p>
        <p className="font-display text-2xl font-bold text-ink-900">{value}</p>
        {hint && <p className="text-xs leading-tight text-slate-500">{hint}</p>}
      </div>
    </Card>
  );
}
export function Pagination({ page, pageSize, total, onChange }: { page: number; pageSize: number; total: number; onChange: (page: number) => void }) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (total <= pageSize) return <p className="mt-3 text-xs text-slate-500">{total} result{total === 1 ? '' : 's'}</p>;
  return (
    <div className="mt-4 flex items-center justify-between text-sm text-slate-600">
      <span>{(page - 1) * pageSize + 1}–{Math.min(page * pageSize, total)} of {total}</span>
      <div className="flex gap-2">
        <Button variant="secondary" size="sm" icon={ChevronLeft} disabled={page <= 1} onClick={() => onChange(page - 1)}>Previous</Button>
        <Button variant="secondary" size="sm" disabled={page >= pages} onClick={() => onChange(page + 1)}>Next <ChevronRight className="size-4" /></Button>
      </div>
    </div>
  );
}
export function Progress({ value, tone }: { value: number; tone?: 'auto' | Tone }) {
  const auto = value >= 85 ? 'bg-red-500' : value >= 60 ? 'bg-amber-500' : 'bg-emerald-500';
  return (
    <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-200" role="progressbar" aria-valuenow={Math.round(value)} aria-valuemin={0} aria-valuemax={100}>
      <div className={cx('h-full rounded-full transition-all duration-500', tone && tone !== 'auto' ? 'bg-brand-600' : auto)} style={{ width: `${Math.min(100, Math.max(0, value))}%` }} />
    </div>
  );
}
