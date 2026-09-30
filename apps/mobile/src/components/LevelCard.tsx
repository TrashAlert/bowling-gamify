import type { LevelProgress } from '@bowling-rpg/progression';
import { Pressable, StyleSheet, Text } from 'react-native';
import { colors, font, radius, space } from '@/theme';
import { XpBar } from './XpBar';

export interface LevelCardProps {
  readonly progress: LevelProgress;
  readonly onPress?: () => void;
}

/** The bowler's level at a glance: Home's headline. */
export function LevelCard({ progress, onPress }: LevelCardProps) {
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? 'button' : 'summary'}
      accessibilityHint={onPress ? 'Opens your progress' : undefined}
      style={({ pressed }) => [styles.card, pressed && { opacity: 0.85 }]}
    >
      <XpBar progress={progress} />
      <Text style={styles.hint}>
        {progress.xpToNext} XP to level {progress.level + 1} · {progress.totalXp} XP total
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: space.lg, gap: space.sm },
  hint: { color: colors.textMuted, fontSize: font.small },
});
