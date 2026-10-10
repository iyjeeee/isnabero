export interface DateRange {
  from?: string; // YYYY-MM-DD, inclusive; blank/undefined = no lower bound
  to?: string; // YYYY-MM-DD, inclusive; blank/undefined = no upper bound
}

// toLocalYmd: the local-timezone calendar day of a Date (YYYY-MM-DD) — what a date input holds; not toISOString (UTC would shift the day)
export function toLocalYmd(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

// inDateRange: both bounds inclusive, either may be omitted
export function inDateRange(ymd: string, range: DateRange): boolean {
  if (range.from && ymd < range.from) return false;
  if (range.to && ymd > range.to) return false;
  return true;
}

// validateDateRange: returns a user-facing message, or null when the range is usable
export function validateDateRange(range: DateRange): string | null {
  if (range.from && range.to && range.from > range.to) return "“From” can't be after “To”.";
  return null;
}
