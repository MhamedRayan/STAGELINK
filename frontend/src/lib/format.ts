// All date display goes through this file (design-plan §2 "Dates").
const LOCALE = 'en-GB';
const TIME_ZONE = 'Africa/Algiers';

function parts(date: Date, withTime: boolean): Record<string, string> {
  const formatter = new Intl.DateTimeFormat(LOCALE, {
    timeZone: TIME_ZONE,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    ...(withTime ? { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' as const } : {}),
  });
  const out: Record<string, string> = {};
  for (const p of formatter.formatToParts(date)) out[p.type] = p.value;
  return out;
}

function toDate(value: string | Date | null | undefined): Date | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** dd/mm/yyyy */
export function formatDate(value: string | Date | null | undefined, empty = '—'): string {
  const date = toDate(value);
  if (!date) return empty;
  const p = parts(date, false);
  return `${p.day}/${p.month}/${p.year}`;
}

/** dd/mm/yyyy HH:mm */
export function formatDateTime(value: string | Date | null | undefined, empty = '—'): string {
  const date = toDate(value);
  if (!date) return empty;
  const p = parts(date, true);
  return `${p.day}/${p.month}/${p.year} ${p.hour}:${p.minute}`;
}

const RELATIVE_UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ['year', 31_536_000],
  ['month', 2_592_000],
  ['day', 86_400],
  ['hour', 3_600],
  ['minute', 60],
];

/** "2 hours ago" — used only in notification rows (with an absolute tooltip). */
export function formatRelative(value: string | Date | null | undefined, now = new Date()): string {
  const date = toDate(value);
  if (!date) return '—';
  const diffSeconds = Math.round((date.getTime() - now.getTime()) / 1000);
  const formatter = new Intl.RelativeTimeFormat(LOCALE, { numeric: 'always' });
  for (const [unit, seconds] of RELATIVE_UNITS) {
    if (Math.abs(diffSeconds) >= seconds) {
      return formatter.format(Math.trunc(diffSeconds / seconds), unit);
    }
  }
  return 'just now';
}

/** Grades arrive as decimal strings ("17.50"); show up to two decimals, no trailing zeros. */
export function formatGrade(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === '') return '—';
  const n = typeof value === 'number' ? value : Number.parseFloat(value);
  if (Number.isNaN(n)) return '—';
  return n.toLocaleString(LOCALE, { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

/** File size for upload lists: "1.2 MB". */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
