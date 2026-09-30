import { FULL_RACK, type NextDelivery, maskFromPins, scoreGame } from '@bowling-rpg/scoring';
import { act, fireEvent, render, renderHook, screen } from '@testing-library/react-native';
import type { SQLiteDatabase } from 'expo-sqlite';
import { FrameStrip } from '@/components/FrameStrip';
import { PinDeck } from '@/components/PinDeck';
import { ScoringPad } from '@/components/ScoringPad';
import { fetchCurrentGame, startSession } from '@/db/games';
import { useLiveGame } from '@/features/live-scoring/use-live-game';
import { createMemoryDb } from './memory-db';

const pins = (...p: number[]) => maskFromPins(p);
const firstBall: NextDelivery = { frameNumber: 1, deliveryInFrame: 1, standing: FULL_RACK, newRack: true };

describe('PinDeck', () => {
  it('toggles standing pins and ignores pins already down', async () => {
    const onToggle = jest.fn();
    await render(<PinDeck standing={pins(7, 10)} selected={pins(10)} onToggle={onToggle} />);

    await fireEvent.press(screen.getByTestId('pin-7'));
    await fireEvent.press(screen.getByTestId('pin-1'));

    expect(onToggle).toHaveBeenCalledTimes(1);
    expect(onToggle).toHaveBeenCalledWith(7);
    expect(screen.getByLabelText('Pin 10')).toBeChecked();
    expect(screen.getByLabelText('Pin 1')).toBeDisabled();
  });
});

describe('ScoringPad', () => {
  const setup = async (next = firstBall, canUndo = false) => {
    const onRecord = jest.fn();
    const onUndo = jest.fn();
    await render(<ScoringPad next={next} onRecord={onRecord} onUndo={onUndo} canUndo={canUndo} />);
    return { onRecord, onUndo };
  };

  it('records a strike in one tap', async () => {
    const { onRecord } = await setup();
    await fireEvent.press(screen.getByText('Strike'));
    expect(onRecord).toHaveBeenCalledWith({ knocked: FULL_RACK, foul: false });
  });

  it('records a leave in three taps, flagging the split first', async () => {
    const { onRecord } = await setup();
    await fireEvent.press(screen.getByTestId('pin-7'));
    await fireEvent.press(screen.getByTestId('pin-10'));

    expect(screen.getByText('SPLIT')).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId('record'));
    expect(onRecord).toHaveBeenCalledWith({ knocked: pins(1, 2, 3, 4, 5, 6, 8, 9), foul: false });
  });

  it('un-marks a pin tapped twice', async () => {
    await setup();
    await fireEvent.press(screen.getByTestId('pin-7'));
    await fireEvent.press(screen.getByTestId('pin-7'));
    expect(screen.getByText('Strike')).toBeOnTheScreen();
  });

  it('records a miss in one tap', async () => {
    const { onRecord } = await setup({ ...firstBall, deliveryInFrame: 2, standing: pins(10), newRack: false });
    await fireEvent.press(screen.getByText('Miss'));
    expect(onRecord).toHaveBeenCalledWith({ knocked: 0, foul: false });
  });

  it('records a foul', async () => {
    const { onRecord } = await setup();
    await fireEvent.press(screen.getByText('Foul'));
    await fireEvent.press(screen.getByText('Foul · all down'));
    expect(onRecord).toHaveBeenCalledWith({ knocked: FULL_RACK, foul: true });
  });

  it('only offers undo when there is a ball to undo', async () => {
    const { onUndo } = await setup(firstBall, false);
    expect(screen.getByText('Undo')).toBeDisabled();
    await fireEvent.press(screen.getByText('Undo'));
    expect(onUndo).not.toHaveBeenCalled();
  });
});

describe('FrameStrip', () => {
  it('shows marks and running totals, ringing splits', async () => {
    const result = scoreGame([...Array.from({ length: 12 }, () => ({ knocked: FULL_RACK }))]);
    if (!result.ok) throw new Error('bad fixture');
    await render(<FrameStrip frames={result.game.frames} currentFrame={null} />);
    expect(screen.getByLabelText('Frame 10: X X X, total 300')).toBeOnTheScreen();
    expect(screen.getByLabelText('Frame 1: X, total 30')).toBeOnTheScreen();
  });

  it('shows frames not yet bowled', async () => {
    await render(<FrameStrip frames={[]} currentFrame={1} />);
    expect(screen.getByLabelText('Frame 4: not bowled')).toBeOnTheScreen();
  });
});

describe('useLiveGame', () => {
  let db: SQLiteDatabase;
  beforeEach(async () => {
    db = await createMemoryDb();
  });

  const load = async (sessionId: string) => {
    const hook = await renderHook(() => useLiveGame(db, sessionId));
    await act(async () => {});
    return hook;
  };

  it('records one strike when the button is double-tapped', async () => {
    const { sessionId } = await startSession(db);
    const { result } = await load(sessionId);
    const live = result.current;
    if (live.status !== 'ready') throw new Error(`status ${live.status}`);

    await act(async () => {
      await Promise.all([live.record({ knocked: FULL_RACK }), live.record({ knocked: FULL_RACK })]);
    });

    expect((await fetchCurrentGame(db, sessionId))?.deliveries).toHaveLength(1);
    expect(result.current.status === 'ready' && result.current.scored.frames).toHaveLength(1);
  });

  it('undoes, starts the next game, and ends the session', async () => {
    const { sessionId } = await startSession(db);
    const { result } = await load(sessionId);
    const ready = () => {
      if (result.current.status !== 'ready') throw new Error(result.current.status);
      return result.current;
    };

    for (let i = 0; i < 12; i++) await act(() => ready().record({ knocked: FULL_RACK }));
    expect(ready().scored.scoreSoFar).toBe(300);

    await act(() => ready().undo());
    expect(ready().scored.isComplete).toBe(false);
    await act(() => ready().record({ knocked: FULL_RACK }));

    await act(() => ready().nextGame());
    expect(ready().game.gameNumber).toBe(2);

    await act(() => ready().end());
    expect(await db.getFirstAsync('SELECT ended_at IS NOT NULL AS ended FROM sessions WHERE id = ?', sessionId)).toEqual({ ended: 1 });
  });

  it('never stores a ball the rules forbid', async () => {
    const { sessionId } = await startSession(db);
    const { result } = await load(sessionId);
    const live = result.current;
    if (live.status !== 'ready') throw new Error(live.status);
    await act(() => live.record({ knocked: 2048 }));
    expect((await fetchCurrentGame(db, sessionId))?.deliveries).toEqual([]);
  });

  it('reports a session that does not exist', async () => {
    const { result } = await load('missing');
    expect(result.current.status).toBe('missing');
  });
});
