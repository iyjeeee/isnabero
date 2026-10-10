// computePercentChange: returns null when there's no meaningful baseline (previous period was zero) —
// dividing by zero would produce a misleading "+Infinity%" or "+100%" that doesn't reflect reality
// (e.g. going from 0 sales to 1 sale isn't "infinite growth", it's a new baseline).
export function computePercentChange(current: number, previous: number): number | null {
  if (previous === 0) return current === 0 ? 0 : null;
  return ((current - previous) / previous) * 100;
}
