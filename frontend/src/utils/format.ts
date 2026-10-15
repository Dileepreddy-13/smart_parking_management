const whole = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 });
const paise = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 2, maximumFractionDigits: 2 });
/** ₹80 for whole rupees, ₹94.40 otherwise (never ₹94.4). */
export const money = (amount: number | null | undefined) =>
  amount === null || amount === undefined ? '—' : (Number.isInteger(amount) ? whole : paise).format(amount);

const dateFmt = new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
const shortDateFmt = new Intl.DateTimeFormat('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
const timeFmt = new Intl.DateTimeFormat('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true });

export const formatDate = (iso: string | Date) => dateFmt.format(new Date(iso));
export const formatShortDate = (iso: string | Date) => shortDateFmt.format(new Date(iso));
export const formatTime = (iso: string | Date) => timeFmt.format(new Date(iso)).toUpperCase();
export const formatDateTime = (iso: string | Date) => `${formatDate(iso)}, ${formatTime(iso)}`;

export function formatDuration(hours: number) {
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  return [h ? `${h} h` : '', m ? `${m} min` : ''].filter(Boolean).join(' ') || '0 min';
}

export function timeAgo(iso: string) {
  const seconds = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)} min ago`;
  if (seconds < 86_400) return `${Math.floor(seconds / 3600)} h ago`;
  if (seconds < 7 * 86_400) return `${Math.floor(seconds / 86_400)} d ago`;
  return formatDate(iso);
}

const pad = (n: number) => String(n).padStart(2, '0');
/** YYYY-MM-DD in the browser's local time, for <input type="date">. */
export const toDateInput = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const toTimeInput = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;
/** Combines local date and time inputs into a Date (null when either is missing or invalid). */
export function fromInputs(date: string, time: string): Date | null {
  if (!date || !time) return null;
  const d = new Date(`${date}T${time}:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** The next half-hour boundary at least `leadMinutes` from now. */
export function nextHalfHour(leadMinutes = 10, from = new Date()) {
  const d = new Date(from.getTime() + leadMinutes * 60_000);
  d.setSeconds(0, 0);
  d.setMinutes(d.getMinutes() <= 30 ? 30 : 60);
  return d;
}

export const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
export const titleCase = (s: string) => s.charAt(0) + s.slice(1).toLowerCase().replace(/_/g, ' ');
export const vehicleLabel: Record<string, string> = { CAR: 'Car', BIKE: 'Bike', EV: 'Electric' };

export function downloadCsv(filename: string, rows: Array<Record<string, string | number | null>>) {
  if (rows.length === 0) return;
  const headers = Object.keys(rows[0]);
  const escape = (v: string | number | null) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const csv = [headers.join(','), ...rows.map((r) => headers.map((h) => escape(r[h])).join(','))].join('\n');
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  const link = Object.assign(document.createElement('a'), { href: url, download: filename });
  link.click();
  URL.revokeObjectURL(url);
}
