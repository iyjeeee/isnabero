// Calendar-day helpers on YYYY-MM-DD strings. They work in local time and avoid toISOString (UTC would shift the day).
const pad = (value: number) => String(value).padStart(2, "0");

export function toYmd(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function fromYmd(ymd: string): Date {
  const [year, month, day] = ymd.split("-").map(Number) as [number, number, number];
  return new Date(year, month - 1, day);
}

// isRealDate: format check plus a real-calendar check (rejects 2026-02-31)
export function isRealDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  return toYmd(fromYmd(value)) === value;
}

export function addDays(ymd: string, days: number): string {
  const date = fromYmd(ymd);
  date.setDate(date.getDate() + days);
  return toYmd(date);
}

// weekStartOf: the Monday of the week containing `ymd` (weeks run Monday to Sunday)
export function weekStartOf(ymd: string): string {
  return addDays(ymd, -((fromYmd(ymd).getDay() + 6) % 7));
}

// weekDays: the seven days (Mon..Sun) of the week containing `ymd`
export function weekDays(ymd: string): string[] {
  const start = weekStartOf(ymd);
  return Array.from({ length: 7 }, (_, index) => addDays(start, index));
}
