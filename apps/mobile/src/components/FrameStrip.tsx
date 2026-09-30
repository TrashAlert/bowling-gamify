import { FRAMES_PER_GAME, type ScoredFrame } from '@bowling-rpg/scoring';
import { StyleSheet, Text, View } from 'react-native';
import { markFor } from '@/features/live-scoring/entry';
import { colors, font, radius, space } from '@/theme';

export interface FrameStripProps {
  readonly frames: readonly ScoredFrame[];
  /** Frame the next ball belongs to, highlighted. Null once the game is over. */
  readonly currentFrame: number | null;
}

/** The scoresheet: ten boxes of marks with running totals, as the overhead monitor shows it. */
export function FrameStrip({ frames, currentFrame }: FrameStripProps) {
  return (
    <View style={styles.strip}>
      {Array.from({ length: FRAMES_PER_GAME }, (_, i) => {
        const number = i + 1;
        const frame = frames[i];
        const marks = frame?.deliveries.map(markFor) ?? [];
        const total = frame?.cumulativeScore;
        return (
          <View
            key={number}
            testID={`frame-${number}`}
            style={[styles.frame, number === FRAMES_PER_GAME && styles.tenth, number === currentFrame && styles.current]}
            accessibilityLabel={`Frame ${number}: ${marks.map((m) => m.text).join(' ') || 'not bowled'}${total == null ? '' : `, total ${total}`}`}
          >
            <Text style={styles.number}>{number}</Text>
            <View style={styles.marks}>
              {marks.map((mark, j) => (
                <Text key={j} style={[styles.mark, mark.ringed && styles.ringed]}>
                  {mark.text}
                </Text>
              ))}
            </View>
            <Text style={styles.total}>{total ?? ''}</Text>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  strip: { flexDirection: 'row', gap: 2 },
  frame: {
    flex: 2,
    minHeight: 64,
    backgroundColor: colors.surface,
    borderRadius: radius.sm,
    paddingVertical: space.xs,
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: colors.surface,
  },
  tenth: { flex: 3 },
  current: { borderColor: colors.accent },
  number: { color: colors.textMuted, fontSize: 10 },
  marks: { flexDirection: 'row', gap: 2, minHeight: 18 },
  mark: { color: colors.text, fontSize: font.small, fontWeight: '700', minWidth: 10, textAlign: 'center' },
  ringed: { borderWidth: 1, borderColor: colors.warning, borderRadius: radius.pill, paddingHorizontal: 3 },
  total: { color: colors.text, fontSize: font.small, fontWeight: '600', minHeight: 16 },
});
