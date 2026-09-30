/** "Sun 28 Sep", in the phone's locale. */
export function formatDay(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
}

/** 0.666 → "67%". */
export function formatPercent(rate: number): string {
  return `${Math.round(rate * 100)}%`;
}
