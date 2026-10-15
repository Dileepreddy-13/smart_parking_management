import { env } from '../config/env';

const partsFormatter = new Intl.DateTimeFormat('en-GB', {
  timeZone: env.APP_TIMEZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  weekday: 'short',
  hourCycle: 'h23',
});
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export interface LocalParts {
  dateKey: string; // YYYY-MM-DD in APP_TIMEZONE
  hhmm: string; // HH:MM in APP_TIMEZONE
  dayOfWeek: number; // 0 = Sunday
}

/** Breaks an instant into calendar parts in the application's timezone. */
export function localParts(date: Date): LocalParts {
  const p = Object.fromEntries(partsFormatter.formatToParts(date).map((x) => [x.type, x.value]));
  return {
    dateKey: `${p.year}-${p.month}-${p.day}`,
    hhmm: `${p.hour}:${p.minute}`,
    dayOfWeek: WEEKDAYS.indexOf(p.weekday),
  };
}

/** The instant at which the current calendar day began in the application's timezone. */
export function startOfLocalDay(date = new Date()): Date {
  const { dateKey, hhmm } = localParts(date);
  const [h, m] = hhmm.split(':').map(Number);
  const start = new Date(date.getTime() - (h * 60 + m) * 60_000);
  start.setUTCSeconds(0, 0);
  // Guard against DST shifts: step back until we are on the same local date at 00:00.
  return localParts(start).dateKey === dateKey ? start : new Date(start.getTime() + 3_600_000);
}

export function formatDateTime(date: Date): string {
  return new Intl.DateTimeFormat('en-IN', {
    timeZone: env.APP_TIMEZONE,
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

export const minutesFromNow = (minutes: number) => new Date(Date.now() + minutes * 60_000);
