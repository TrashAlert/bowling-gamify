import { TIER_NAMES, type Tier } from '@bowling-rpg/progression';
import { type PinMask, formatPins } from '@bowling-rpg/scoring';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, font, radius, space, tierColors } from '@/theme';
import { MiniRack } from './MiniRack';

export interface MonsterRowProps {
  readonly leave: PinMask;
  readonly name: string | undefined;
  readonly tier: Tier;
  /** Right-hand line, e.g. "✓ Slain" or "3 of 5 · 60%". */
  readonly detail: string;
  readonly tone?: 'good' | 'bad' | 'neutral';
  readonly isNew?: boolean;
  readonly onPress: () => void;
}

/** One leave as a monster. Used by the after-action report and the bestiary. */
export function MonsterRow({ leave, name, tier, detail, tone = 'neutral', isNew = false, onPress }: MonsterRowProps) {
  const pins = formatPins(leave);
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${name ? `${name}, ` : ''}${pins}, ${TIER_NAMES[tier]}${isNew ? ', new' : ''}, ${detail}`}
      style={({ pressed }) => [styles.row, pressed && { opacity: 0.8 }]}
    >
      <MiniRack leave={leave} />
      <View style={styles.body}>
        <View style={styles.titleLine}>
          <Text style={styles.title}>{name ?? pins}</Text>
          {isNew && <Text style={styles.newBadge}>NEW</Text>}
        </View>
        <Text style={[styles.tier, { color: tierColors[tier] }]}>
          {TIER_NAMES[tier]}
          {name ? ` · ${pins}` : ''}
        </Text>
      </View>
      <Text style={[styles.detail, tone === 'good' && styles.good, tone === 'bad' && styles.bad]}>{detail}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.lg,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: space.md,
    minHeight: 64,
  },
  body: { flex: 1, gap: 2 },
  titleLine: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  title: { color: colors.text, fontSize: font.body, fontWeight: '700' },
  newBadge: {
    color: colors.accentText,
    backgroundColor: colors.accent,
    fontSize: 11,
    fontWeight: '800',
    paddingHorizontal: space.xs + 2,
    borderRadius: radius.sm,
    overflow: 'hidden',
  },
  tier: { fontSize: font.small, fontWeight: '600' },
  detail: { color: colors.textMuted, fontSize: font.small, fontWeight: '700' },
  good: { color: colors.success },
  bad: { color: colors.danger },
});
