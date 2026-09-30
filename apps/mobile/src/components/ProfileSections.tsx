import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { FavouriteBall } from '@/db/profile';
import type { Achievement, Badge } from '@/features/profile/placeholders';
import { colors, font, radius, space } from '@/theme';

/** The favourite ball, or an invitation to add one. */
export function BallCard({ ball, onAdd }: { ball: FavouriteBall | null; onAdd: () => void }) {
  if (!ball) {
    return (
      <Pressable onPress={onAdd} accessibilityRole="button" style={({ pressed }) => [styles.card, styles.row, pressed && { opacity: 0.8 }]}>
        <Ionicons name="add-circle-outline" size={28} color={colors.textMuted} />
        <Text style={styles.muted}>Add your favourite ball</Text>
      </Pressable>
    );
  }
  const details = [ball.brand, ball.weightLb === null ? null : `${ball.weightLb} lb`].filter(Boolean).join(' · ');
  return (
    <View style={[styles.card, styles.row]} accessible accessibilityLabel={`Favourite ball: ${ball.name}${details ? `, ${details}` : ''}`}>
      <View style={styles.ball}>
        <Ionicons name="bowling-ball" size={24} color={colors.accent} />
      </View>
      <View style={styles.text}>
        <Text style={styles.ballName}>{ball.name}</Text>
        {details !== '' && <Text style={styles.muted}>{details}</Text>}
      </View>
    </View>
  );
}

/** Locked badges: a placeholder grid until badges are earned for real. */
export function BadgeGrid({ badges }: { badges: readonly Badge[] }) {
  return (
    <View style={styles.grid}>
      {badges.map((badge) => (
        <View key={badge.key} style={styles.badge} accessible accessibilityLabel={`${badge.name}, locked`}>
          <View style={styles.badgeIcon}>
            <Ionicons name={badge.icon} size={26} color={colors.textMuted} />
            <View style={styles.lock}>
              <Ionicons name="lock-closed" size={11} color={colors.text} />
            </View>
          </View>
          <Text style={styles.badgeName} numberOfLines={2}>
            {badge.name}
          </Text>
        </View>
      ))}
    </View>
  );
}

/** Locked achievements: a placeholder list until they can be earned. */
export function AchievementList({ achievements }: { achievements: readonly Achievement[] }) {
  return (
    <View style={styles.card}>
      {achievements.map((achievement, i) => (
        <View
          key={achievement.key}
          style={[styles.achievement, i < achievements.length - 1 && styles.divider]}
          accessible
          accessibilityLabel={`${achievement.name}: ${achievement.description} Locked.`}
        >
          <Ionicons name="lock-closed-outline" size={18} color={colors.textMuted} />
          <View style={styles.text}>
            <Text style={styles.achievementName}>{achievement.name}</Text>
            <Text style={styles.muted}>{achievement.description}</Text>
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.surface, borderRadius: radius.md, padding: space.lg },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  text: { flex: 1, gap: 2 },
  muted: { color: colors.textMuted, fontSize: font.small },
  ball: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.surfaceRaised, alignItems: 'center', justifyContent: 'center' },
  ballName: { color: colors.text, fontSize: font.body, fontWeight: '700' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  badge: {
    width: '31%',
    flexGrow: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    paddingVertical: space.md,
    alignItems: 'center',
    gap: space.xs,
  },
  badgeIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.surfaceRaised,
    alignItems: 'center',
    justifyContent: 'center',
    opacity: 0.6,
  },
  lock: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeName: { color: colors.textMuted, fontSize: font.small, textAlign: 'center', paddingHorizontal: space.xs },
  achievement: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.sm },
  divider: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  achievementName: { color: colors.text, fontSize: font.body, fontWeight: '600' },
});
