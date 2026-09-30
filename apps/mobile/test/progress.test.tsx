import { FULL_RACK, type DeliveryInput, maskFromPins, without } from '@bowling-rpg/scoring';
import { fireEvent, render, screen } from '@testing-library/react-native';
import type { SQLiteDatabase } from 'expo-sqlite';
import { ChartCard } from '@/components/ChartCard';
import { type ChartSeries, LineChart, pathFor } from '@/components/LineChart';
import { StatTile } from '@/components/StatTile';
import { appendDelivery, endSession, startNextGame, startSession } from '@/db/games';
import { progressPoints, loadHistory } from '@/features/history/load';
import { PERCENT_SCALE, comparisonCaption, delta, formTiles, formatRate, scoreScale } from '@/features/progress/present';
import { createMemoryDb } from './memory-db';

const leave = (...p: number[]): DeliveryInput => ({ knocked: without(FULL_RACK, maskFromPins(p)) });
const hit = (...p: number[]): DeliveryInput => ({ knocked: maskFromPins(p) });
const PERFECT: DeliveryInput[] = Array.from({ length: 12 }, () => ({ knocked: FULL_RACK }));
/** Ten 10-pin leaves, all converted, and a 9 fill: 190, 10 of 10 spares, no strikes. */
const NINE_SPARES: DeliveryInput[] = [...Array.from({ length: 10 }, () => [leave(10), hit(10)]).flat(), hit(1, 2, 3, 4, 5, 6, 7, 8, 9)];

describe('recent form tiles', () => {
  it('arrow and sign every change, and call a change that rounds to nothing "same"', () => {
    expect(delta(12.4)).toEqual({ text: '▲ 12', direction: 'better' });
    expect(delta(-3, { unit: ' pts' })).toEqual({ text: '▼ 3 pts', direction: 'worse' });
    expect(delta(0.3)).toEqual({ text: '= no change', direction: 'same' });
  });

  it('treat fewer open frames as better', () => {
    expect(delta(-0.5, { decimals: 1, higherIsBetter: false })).toEqual({ text: '▼ 0.5', direction: 'better' });
  });

  it('compare average, strikes, spares and open frames', () => {
    const tiles = formTiles({
      window: 10,
      recent: { games: 10, average: 172.4, strikeRate: 0.42, spareRate: 0.6, opensPerGame: 2.1 },
      previous: { games: 10, average: 160, strikeRate: 0.4, spareRate: null, opensPerGame: 3 },
    });
    expect(tiles).toEqual([
      { label: 'Average', value: '172', delta: { text: '▲ 12', direction: 'better' } },
      { label: 'Strikes', value: '42%', delta: { text: '▲ 2 pts', direction: 'better' } },
      // No spare chances before: nothing to compare against, so no delta at all.
      { label: 'Spares', value: '60%' },
      { label: 'Open frames', value: '2.1', delta: { text: '▼ 0.9', direction: 'better' } },
    ]);
  });

  it('name the stretch being compared, and show a dash for a missing rate', () => {
    expect(comparisonCaption({ window: 3 } as never)).toBe('Last 3 games vs the 3 before');
    expect(formatRate(null)).toBe('—');
  });
});

describe('the score scale', () => {
  it('rounds out to clean bounds', () => {
    expect(scoreScale([132, 187, 171])).toEqual({ min: 100, max: 200, ticks: [100, 150, 200] });
  });

  it('steps by 100 across a wide spread, capped at 300', () => {
    expect(scoreScale([45, 290])).toEqual({ min: 0, max: 300, ticks: [0, 100, 200, 300] });
  });

  it('never narrower than 50 pins, even at 300', () => {
    expect(scoreScale([150, 150])).toEqual({ min: 150, max: 200, ticks: [150, 200] });
    expect(scoreScale([300, 300])).toEqual({ min: 250, max: 300, ticks: [250, 300] });
  });
});

describe('progress points from the phone', () => {
  let db: SQLiteDatabase;
  beforeEach(async () => {
    db = await createMemoryDb();
  });

  it('cover finished games only, with rolling form', async () => {
    const { sessionId, gameId } = await startSession(db);
    for (const ball of NINE_SPARES) await appendDelivery(db, gameId, ball);
    const second = await startNextGame(db, sessionId);
    for (const ball of PERFECT) await appendDelivery(db, second, ball);
    const third = await startNextGame(db, sessionId);
    await appendDelivery(db, third, { knocked: FULL_RACK }); // unfinished: left out
    await endSession(db, sessionId);

    const points = progressPoints(await loadHistory(db));
    expect(points.map((p) => p.metrics.score)).toEqual([190, 300]);
    // 11 fresh racks: ten frames, plus the fill ball after the tenth-frame spare.
    expect(points[0]!.metrics).toMatchObject({ spares: 10, spareChances: 10, strikes: 0, strikeChances: 11 });
    // After both: (190 + 300) / 2, and 12 strikes from 11 + 12 fresh racks.
    expect(points[1]!.rolling).toMatchObject({ games: 2, average: 245, strikeRate: 12 / 23 });
  });
});

describe('chart pieces', () => {
  it('a line path breaks at gaps', () => {
    const d = pathFor([10, 20, null, 40], (i) => i * 10, (v) => v);
    expect(d).toBe('M0.0,10.0 L10.0,20.0 M30.0,40.0');
  });

  it('a stat tile reads its change aloud in words', async () => {
    await render(<StatTile label="Average" value="172" delta={{ text: '▲ 12', direction: 'better' }} />);
    expect(screen.getByLabelText('Average 172, up 12, better')).toBeOnTheScreen();
    expect(screen.getByText('▲ 12')).toBeOnTheScreen();
  });

  const series: ChartSeries[] = [
    { key: 'score', label: 'Game', color: '#888', mark: 'dots', values: [150, 190, 170] },
    { key: 'average', label: '5-game average', color: '#39f', mark: 'line', values: [150, 170, 170] },
  ];

  const renderChart = async () => {
    await render(
      <ChartCard title="Score" legend={series} table={{ columns: ['Game', 'Score'], rows: [['G3', '170'], ['G2', '190'], ['G1', '150']] }}>
        <LineChart series={series} xLabels={['G1', 'G2', 'G3']} scale={scoreScale([150, 190])} format={String} summary="Scores for 3 games." />
      </ChartCard>,
    );
    await fireEvent(screen.getByTestId('chart-plot'), 'layout', { nativeEvent: { layout: { width: 300, height: 190 } } });
  };

  it('a chart shows the latest point until you drag across it', async () => {
    await renderChart();
    expect(screen.getByText('G3')).toBeOnTheScreen();
    expect(screen.getByLabelText('Scores for 3 games.')).toBeOnTheScreen();

    // Plot spans x 36..256; x 36 is the first game.
    await fireEvent(screen.getByTestId('chart-plot'), 'responderGrant', { nativeEvent: { locationX: 40 } });
    expect(screen.getAllByText('150').length).toBeGreaterThan(0);
    expect(screen.getByText('G1')).toBeOnTheScreen();

    await fireEvent(screen.getByTestId('chart-plot'), 'responderRelease');
    expect(screen.getAllByText('G3').length).toBeGreaterThan(0);
  });

  it('a chart card has a legend and a table of its numbers', async () => {
    await renderChart();
    // Once in the legend, once in the readout.
    expect(screen.getAllByText('5-game average')).toHaveLength(2);
    expect(screen.queryByText('Score', { exact: true })).toBeOnTheScreen();

    await fireEvent.press(screen.getByText('Show numbers'));
    expect(screen.getByText('190')).toBeOnTheScreen();
    await fireEvent.press(screen.getByText('Hide numbers'));
    expect(screen.queryByText('190')).toBeNull();
  });

  it('the percent scale runs 0 to 100', () => {
    expect(PERCENT_SCALE).toEqual({ min: 0, max: 100, ticks: [0, 50, 100] });
  });
});
