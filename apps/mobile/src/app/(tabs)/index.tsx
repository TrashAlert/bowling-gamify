import { scoreGame } from '@bowling-rpg/scoring';
import { router, useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { LevelCard } from '@/components/LevelCard';
import { type RecentGame, fetchRecentGames, startSession } from '@/db/games';
import { levelsReached } from '@/features/history/load';
import { useHistory } from '@/features/history/use-history';
import { formatDay } from '@/lib/format';
import { colors, font, radius, space, touch } from '@/theme';

export default function HomeScreen() {
  const db = useSQLiteContext();
  const [games, setGames] = useState<RecentGame[] | null>(null);
  const history = useHistory(db);
  const reached = history ? levelsReached(history) : null;

  // Reload whenever Home comes back into view, e.g. after a session ends.
  useFocusEffect(
    useCallback(() => {
      void fetchRecentGames(db).then(setGames);
    }, [db]),
  );

  const openSession = games?.find((g) => g.sessionOpen)?.sessionId;
  const start = async () => {
    const { sessionId } = await startSession(db);
    router.push(`/session/${sessionId}`);
  };

  return (
    <View style={styles.screen}>
      <FlatList
        data={games ?? []}
        keyExtractor={(g) => g.gameId}
        contentContainerStyle={styles.content}
        ListHeaderComponent={
          <View style={styles.header}>
            <Text style={styles.title}>Bowling RPG</Text>
            {history && <LevelCard progress={history.progression.current} onPress={() => router.push('/progress')} />}
            <Pressable
              onPress={() => (openSession ? router.push(`/session/${openSession}`) : void start())}
              accessibilityRole="button"
              style={({ pressed }) => [styles.start, pressed && { opacity: 0.85 }]}
            >
              <Text style={styles.startText}>{openSession ? 'Resume session' : 'Start bowling'}</Text>
            </Pressable>
            {games && games.length > 0 && <Text style={styles.section}>Recent games</Text>}
          </View>
        }
        ListEmptyComponent={
          games ? <Text style={styles.empty}>Log your first game. Every ball is saved on your phone as you go.</Text> : null
        }
        renderItem={({ item }) => <GameRow game={item} levelReached={reached?.get(item.gameId)} />}
      />
    </View>
  );
}

function GameRow({ game, levelReached }: { game: RecentGame; levelReached: number | undefined }) {
  const result = scoreGame(game.deliveries);
  const scored = result.ok ? result.game : null;
  const inProgress = game.sessionOpen && !scored?.isComplete;
  const state = scored?.isComplete ? null : inProgress ? 'in progress' : 'unfinished';
  // A game still being bowled resumes the session; anything else opens its report.
  const open = () => router.push(inProgress ? `/session/${game.sessionId}` : `/game/${game.gameId}`);
  return (
    <Pressable
      onPress={open}
      accessibilityRole="button"
      accessibilityHint={inProgress ? 'Resumes the session' : 'Opens the game report'}
      style={({ pressed }) => [styles.row, pressed && { opacity: 0.8 }]}
    >
      <View>
        <Text style={styles.rowTitle}>Game {game.gameNumber}</Text>
        <Text style={styles.rowMeta}>
          {formatDay(game.startedAt)}
          {state ? ` · ${state}` : ''}
        </Text>
        {levelReached !== undefined && <Text style={styles.levelUp}>★ Reached level {levelReached}</Text>}
      </View>
      <Text style={styles.rowScore}>{scored?.scoreSoFar ?? '—'}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: space.lg, gap: space.sm },
  header: { gap: space.xl, marginBottom: space.md },
  title: { color: colors.text, fontSize: font.title, fontWeight: '800' },
  start: { minHeight: touch.primary * 1.4, borderRadius: radius.lg, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
  startText: { color: colors.accentText, fontSize: font.title, fontWeight: '800' },
  section: { color: colors.textMuted, fontSize: font.small, textTransform: 'uppercase', letterSpacing: 1 },
  empty: { color: colors.textMuted, fontSize: font.body, textAlign: 'center', marginTop: space.xl },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: space.lg,
  },
  rowTitle: { color: colors.text, fontSize: font.body, fontWeight: '600' },
  rowMeta: { color: colors.textMuted, fontSize: font.small, marginTop: 2 },
  levelUp: { color: colors.accent, fontSize: font.small, fontWeight: '700', marginTop: 2 },
  rowScore: { color: colors.text, fontSize: font.title, fontWeight: '800' },
});
