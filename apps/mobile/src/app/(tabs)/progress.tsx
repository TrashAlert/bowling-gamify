import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LevelCard } from '@/components/LevelCard';
import { useHistory } from '@/features/history/use-history';
import { formatDay } from '@/lib/format';
import { colors, font, radius, space } from '@/theme';

export default function ProgressScreen() {
  const history = useHistory(useSQLiteContext());
  if (!history) return <SafeAreaView style={styles.screen} />;

  const { games, progression } = history;
  // Completed games only, newest first, each with the XP it earned.
  const earned = progression.gains
    .map((gain, i) => ({ gain, game: games[i]! }))
    .filter(({ game }) => game.scored.isComplete)
    .reverse();
  const best = earned.reduce((max, { gain }) => Math.max(max, gain.xp), 0);
  const average = earned.length === 0 ? 0 : Math.round(progression.current.totalXp / earned.length);

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <FlatList
        data={earned}
        keyExtractor={({ game }) => game.gameId}
        contentContainerStyle={styles.content}
        ListHeaderComponent={
          <View style={styles.header}>
            <Text style={styles.title}>Progress</Text>
            <LevelCard progress={progression.current} />
            <View style={styles.stats}>
              <Stat label="Games" value={String(earned.length)} />
              <Stat label="Avg XP" value={String(average)} />
              <Stat label="Best" value={String(best)} />
            </View>
            {earned.length > 0 && <Text style={styles.section}>XP history</Text>}
          </View>
        }
        ListEmptyComponent={
          <Text style={styles.empty}>Every finished game earns its score in XP, up to 300 for a perfect game. Bowl one to start levelling.</Text>
        }
        renderItem={({ item: { game, gain } }) => (
          <Pressable
            onPress={() => router.push(`/game/${game.gameId}`)}
            accessibilityRole="button"
            style={({ pressed }) => [styles.row, pressed && { opacity: 0.8 }]}
          >
            <View>
              <Text style={styles.rowTitle}>
                {formatDay(game.startedAt)} · Game {game.gameNumber}
              </Text>
              {gain.levelsGained > 0 && <Text style={styles.levelUp}>Reached level {gain.after.level}</Text>}
            </View>
            <Text style={styles.xp}>+{gain.xp} XP</Text>
          </Pressable>
        )}
      />
    </SafeAreaView>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.stat} accessible accessibilityLabel={`${label} ${value}`}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: space.lg, gap: space.sm },
  header: { gap: space.lg, marginTop: space.lg, marginBottom: space.sm },
  title: { color: colors.text, fontSize: font.title, fontWeight: '800' },
  stats: { flexDirection: 'row', gap: space.sm },
  stat: { flex: 1, backgroundColor: colors.surface, borderRadius: radius.md, paddingVertical: space.md, alignItems: 'center' },
  statValue: { color: colors.text, fontSize: font.title, fontWeight: '800' },
  statLabel: { color: colors.textMuted, fontSize: font.small },
  section: { color: colors.textMuted, fontSize: font.small, textTransform: 'uppercase', letterSpacing: 1 },
  empty: { color: colors.textMuted, fontSize: font.body, lineHeight: 22, textAlign: 'center' },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: colors.surface, borderRadius: radius.md, padding: space.lg },
  rowTitle: { color: colors.text, fontSize: font.body, fontWeight: '600' },
  levelUp: { color: colors.accent, fontSize: font.small, fontWeight: '700', marginTop: 2 },
  xp: { color: colors.accent, fontSize: font.body, fontWeight: '800' },
});
