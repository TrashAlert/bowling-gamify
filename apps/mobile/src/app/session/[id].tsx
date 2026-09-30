import { maxPossibleScore } from '@bowling-rpg/scoring';
import { useKeepAwake } from 'expo-keep-awake';
import { router, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FrameStrip } from '@/components/FrameStrip';
import { GameReportView } from '@/components/GameReportView';
import { ScoringPad } from '@/components/ScoringPad';
import { features } from '@/features';
import { useGameReport } from '@/features/history/use-game-report';
import { useLiveGame } from '@/features/live-scoring/use-live-game';
import { colors, font, radius, space, touch } from '@/theme';

export default function SessionScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const db = useSQLiteContext();
  const live = useLiveGame(db, id);
  const finished = live.status === 'ready' && live.scored.isComplete;
  // Loaded only once the game is over; keyed on ball count so an undo refreshes it.
  const report = useGameReport(db, finished ? live.game.gameId : null, live.status === 'ready' ? live.game.deliveries.length : 0);
  // Phones sleep after 30s; a frame takes longer than that.
  useKeepAwake();

  if (live.status === 'loading') return <SafeAreaView style={styles.screen} />;
  if (live.status === 'missing') {
    return (
      <SafeAreaView style={[styles.screen, styles.centred]}>
        <Text style={styles.muted}>This session no longer exists.</Text>
        <Button label="Back" onPress={() => router.back()} />
      </SafeAreaView>
    );
  }

  const { game, scored } = live;
  const finish = async () => {
    await live.end();
    router.back();
  };
  const confirmEnd = () =>
    scored.isComplete
      ? void finish()
      : Alert.alert('End session?', 'Every ball so far is saved. This game will be kept as unfinished.', [
          { text: 'Keep bowling', style: 'cancel' },
          { text: 'End session', style: 'destructive', onPress: () => void finish() },
        ]);

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content} bounces={false}>
        <View style={styles.header}>
          <View>
            <Text style={styles.muted}>Game {game.gameNumber}</Text>
            <Text style={styles.score} accessibilityLabel={`Score ${scored.scoreSoFar}`}>
              {scored.scoreSoFar}
            </Text>
            {!scored.isComplete && <Text style={styles.muted}>Best possible {maxPossibleScore(scored)}</Text>}
          </View>
          <Pressable onPress={confirmEnd} accessibilityRole="button" style={styles.endButton}>
            <Text style={styles.endText}>End</Text>
          </Pressable>
        </View>

        <FrameStrip frames={scored.frames} currentFrame={scored.next?.frameNumber ?? null} />

        {scored.next ? (
          <ScoringPad
            key={game.deliveries.length}
            next={scored.next}
            onRecord={(delivery) => void live.record(delivery)}
            onUndo={() => void live.undo()}
            canUndo={game.deliveries.length > 0}
          />
        ) : (
          <View style={styles.gameOver}>
            {report && (
              <GameReportView
                report={report.report}
                xp={report.xp}
                showMonsters={features.bestiary}
                onMonsterPress={(leave) => router.push(`/leave/${leave}`)}
              />
            )}
            <Button label="Next game" onPress={() => void live.nextGame()} primary />
            <Button label="Undo last ball" onPress={() => void live.undo()} />
            <Button label="Finish session" onPress={() => void finish()} />
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function Button({ label, onPress, primary = false }: { label: string; onPress: () => void; primary?: boolean }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => [styles.button, primary && styles.buttonPrimary, pressed && { opacity: 0.8 }]}
    >
      <Text style={[styles.buttonText, primary && styles.buttonTextPrimary]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  centred: { alignItems: 'center', justifyContent: 'center', gap: space.lg },
  content: { padding: space.lg, gap: space.xl },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  score: { color: colors.text, fontSize: font.score, fontWeight: '800' },
  muted: { color: colors.textMuted, fontSize: font.small },
  endButton: { minHeight: touch.min, minWidth: touch.min * 1.5, alignItems: 'center', justifyContent: 'center', borderRadius: radius.md, backgroundColor: colors.surfaceRaised },
  endText: { color: colors.text, fontSize: font.body, fontWeight: '600' },
  gameOver: { gap: space.md, paddingTop: space.lg },
  button: { minHeight: touch.min + space.md, borderRadius: radius.md, backgroundColor: colors.surfaceRaised, alignItems: 'center', justifyContent: 'center' },
  buttonPrimary: { backgroundColor: colors.accent, minHeight: touch.primary },
  buttonText: { color: colors.text, fontSize: font.body, fontWeight: '600' },
  buttonTextPrimary: { color: colors.accentText, fontSize: font.title, fontWeight: '800' },
});
