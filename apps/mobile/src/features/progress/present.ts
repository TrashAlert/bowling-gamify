import type { FormComparison } from '@bowling-rpg/progression';

export type Direction = 'better' | 'worse' | 'same';

export interface Delta {
  /** Signed and arrowed, e.g. "▲ 12" or "▼ 3 pts", so colour never carries it alone. */
  readonly text: string;
  readonly direction: Direction;
}

export interface Tile {
  readonly label: string;
  readonly value: string;
  readonly delta?: Delta;
}

/** "38%", or a dash when there were no chances. */
export const formatRate = (rate: number | null) => (rate === null ? '—' : `${Math.round(rate * 100)}%`);

/**
 * A change, rounded the way it's displayed so "▲ 0" never appears: a change
 * that rounds to nothing is "same". `higherIsBetter` is false for open frames.
 */
export function delta(change: number, { unit = '', decimals = 0, higherIsBetter = true } = {}): Delta {
  const rounded = Number(change.toFixed(decimals));
  if (rounded === 0) return { text: '= no change', direction: 'same' };
  const up = rounded > 0;
  const text = `${up ? '▲' : '▼'} ${Math.abs(rounded).toFixed(decimals)}${unit}`;
  return { text, direction: up === higherIsBetter ? 'better' : 'worse' };
}

const rateDelta = (recent: number | null, previous: number | null): Delta | undefined =>
  recent === null || previous === null ? undefined : delta((recent - previous) * 100, { unit: ' pts' });

/** The four "recent form" tiles: this stretch's value, and how it moved from the stretch before. */
export function formTiles({ recent, previous }: FormComparison): Tile[] {
  return [
    { label: 'Average', value: String(Math.round(recent.average)), delta: delta(recent.average - previous.average) },
    { label: 'Strikes', value: formatRate(recent.strikeRate), ...optional(rateDelta(recent.strikeRate, previous.strikeRate)) },
    { label: 'Spares', value: formatRate(recent.spareRate), ...optional(rateDelta(recent.spareRate, previous.spareRate)) },
    {
      label: 'Open frames',
      value: recent.opensPerGame.toFixed(1),
      delta: delta(recent.opensPerGame - previous.opensPerGame, { decimals: 1, higherIsBetter: false }),
    },
  ];
}

// With exactOptionalPropertyTypes, a missing delta must be absent rather than undefined.
const optional = (d: Delta | undefined): { delta?: Delta } => (d ? { delta: d } : {});

export interface Scale {
  readonly min: number;
  readonly max: number;
  readonly ticks: readonly number[];
}

/**
 * A y-scale for scores: clean round bounds just outside the data, 0-300 at
 * most, with 3-5 ticks at a round step. Never a range narrower than 50, so a
 * run of near-identical games doesn't look like a rollercoaster.
 */
export function scoreScale(values: readonly number[]): Scale {
  const low = Math.min(...values);
  const high = Math.max(...values);
  const step = high - low > 150 ? 100 : 50;
  let min = Math.max(0, Math.floor(low / step) * step);
  let max = Math.min(300, Math.ceil(high / step) * step);
  if (max - min < 50) {
    // Widen upwards, unless already at 300.
    if (max === 300) min = 250;
    else max = min + 50;
  }
  const ticks: number[] = [];
  for (let tick = min; tick <= max; tick += step) ticks.push(tick);
  return { min, max, ticks };
}

export const PERCENT_SCALE: Scale = { min: 0, max: 100, ticks: [0, 50, 100] };

/** The recent-form headline, e.g. "Last 10 games vs the 10 before". */
export function comparisonCaption(comparison: FormComparison): string {
  const n = comparison.window;
  return `Last ${n} games vs the ${n} before`;
}

