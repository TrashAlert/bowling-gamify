import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { HeaderButton } from '@/components/FormField';
import { FrameStrip } from '@/components/FrameStrip';
import { GameReportView } from '@/components/GameReportView';
import { deleteGame } from '@/db/games';
import { features } from '@/features';
import { deleteGameConfirmation } from '@/features/history/delete-game';
import { useGameReport } from '@/features/history/use-game-report';
import { formatDay } from '@/lib/format';
import { colors, font, space } from '@/theme';

/** The after-action report for a past game, reached from Home. */
export default function GameScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const db = useSQLiteContext();
  const loaded = useGameReport(db, id);

  if (loaded === undefined) return <View style={styles.screen} />;
  if (loaded === null) {
    return (
      <View style={[styles.screen, styles.centred]}>
        <Text style={styles.muted}>This game no longer exists.</Text>
      </View>
    );
  }

  const { game, report, xp } = loaded;
  const confirmDelete = () => {
    const { title, message } = deleteGameConfirmation(game, xp);
    Alert.alert(title, message, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete game',
        style: 'destructive',
        // Home reloads on focus, so the list, level, XP and stats all update on return.
        onPress: () => void deleteGame(db, game.gameId).then(() => router.back()),
      },
    ]);
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Stack.Screen
        options={{
          title: `Game ${game.gameNumber} · ${formatDay(game.startedAt)}`,
          headerRight: () => <HeaderButton label="Delete" onPress={confirmDelete} destructive />,
        }}
      />
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
