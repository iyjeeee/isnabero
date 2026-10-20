// changeDue: what to hand back — null while nothing is typed, negative when the customer has not given enough
export function changeDue(total: number, tendered: number): number | null {
  if (!Number.isFinite(tendered)) return null;
  return Math.round((tendered - total) * 100) / 100;
}

// quickTenders: handy "customer gave" amounts — exact, then the next round notes above the total (₱50/100/200/500/1000 steps)
export function quickTenders(total: number): number[] {
  const exact = Math.ceil(total);
  const options = new Set<number>([exact]);
  for (const step of [50, 100, 200, 500, 1000]) {
    const rounded = Math.ceil(total / step) * step;
    if (rounded >= total) options.add(rounded);
  }
  return [...options].sort((a, b) => a - b).slice(0, 4);
}
