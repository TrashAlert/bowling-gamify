import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { FrameStrip } from '@/components/FrameStrip';
import { GameReportView } from '@/components/GameReportView';
import { features } from '@/features';
import { useGameReport } from '@/features/history/use-game-report';
import { formatDay } from '@/lib/format';
import { colors, font, space } from '@/theme';

/** The after-action report for a past game, reached from Home. */
export default function GameScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const loaded = useGameReport(useSQLiteContext(), id);

  if (loaded === undefined) return <View style={styles.screen} />;
  if (loaded === null) {
    return (
      <View style={[styles.screen, styles.centred]}>
        <Text style={styles.muted}>This game no longer exists.</Text>
      </View>
    );
  }

  const { game, report, xp } = loaded;
  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Stack.Screen options={{ title: `Game ${game.gameNumber} · ${formatDay(game.startedAt)}` }} />
      <FrameStrip frames={game.scored.frames} currentFrame={null} />
      <GameReportView report={report} xp={xp} showMonsters={features.bestiary} onMonsterPress={(leave) => router.push(`/leave/${leave}`)} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  centred: { alignItems: 'center', justifyContent: 'center' },
  content: { padding: space.lg, gap: space.xl },
  muted: { color: colors.textMuted, fontSize: font.body },
});
