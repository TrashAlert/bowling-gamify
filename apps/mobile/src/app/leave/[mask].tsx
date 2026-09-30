import { TIER_NAMES, conversionRate } from '@bowling-rpg/progression';
import { formatPins, isPinMask } from '@bowling-rpg/scoring';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { MiniRack } from '@/components/MiniRack';
import { attemptsAt } from '@/features/history/load';
import { useHistory } from '@/features/history/use-history';
import { formatDay, formatPercent } from '@/lib/format';
import { colors, font, radius, space, tierColors } from '@/theme';

const KIND_LABEL = { clear: 'Clear', single: 'Single pin', cluster: 'Cluster', washout: 'Washout', split: 'Split' } as const;

export default function LeaveScreen() {
  const { mask } = useLocalSearchParams<{ mask: string }>();
  const data = useHistory(useSQLiteContext());
  const leave = Number(mask);

  if (!isPinMask(leave) || leave === 0) return <Message text="That isn't a leave." />;
  if (!data) return <View style={styles.screen} />;

  const entry = data.bestiary.find((e) => e.leave === leave);
  const title = entry?.name ?? formatPins(leave);
  if (!entry) {
    return (
      <>
        <Stack.Screen options={{ title }} />
        <Message text="You haven't faced this leave yet." />
      </>
    );
  }

  const attempts = attemptsAt(data, leave);
  const firstMet = data.games.find((g) => g.gameId === entry.firstSeenGameId);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Stack.Screen options={{ title }} />
      <View style={styles.hero}>
        <MiniRack leave={leave} size={22} />
        <Text style={styles.name}>{title}</Text>
        <Text style={[styles.tier, { color: tierColors[entry.tier] }]}>
          {TIER_NAMES[entry.tier]} · {KIND_LABEL[entry.kind]}
          {entry.name ? ` · ${formatPins(leave)}` : ''}
        </Text>
      </View>

      <View style={styles.stats}>
        <Stat label="Faced" value={String(entry.attempts)} />
        <Stat label="Slain" value={String(entry.conversions)} />
        <Stat label="Rate" value={formatPercent(conversionRate(entry))} />
      </View>

      {firstMet && <Text style={styles.muted}>First met {formatDay(firstMet.startedAt)}</Text>}

      <View style={styles.list}>
        <Text style={styles.section}>Every attempt</Text>
        {attempts.map(({ game, encounter }, i) => (
          <View key={`${game.gameId}-${encounter.frameNumber}-${i}`} style={styles.attempt}>
            <Text style={styles.attemptText}>
              {formatDay(game.startedAt)} · Game {game.gameNumber} · Frame {encounter.frameNumber}
            </Text>
            <Text style={[styles.attemptResult, encounter.converted ? styles.good : styles.bad]}>
              {encounter.converted ? '✓ Slain' : '✗ Escaped'}
            </Text>
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

function Message({ text }: { text: string }) {
  return (
    <View style={[styles.screen, styles.centred]}>
      <Text style={styles.muted}>{text}</Text>
    </View>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.stat} accessible accessibilityLabel={`${label} ${value}`}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.muted}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  centred: { alignItems: 'center', justifyContent: 'center' },
  content: { padding: space.lg, gap: space.xl },
  hero: { alignItems: 'center', gap: space.sm, paddingVertical: space.lg },
  name: { color: colors.text, fontSize: font.title, fontWeight: '800', marginTop: space.md },
  tier: { fontSize: font.small, fontWeight: '700' },
  stats: { flexDirection: 'row', gap: space.sm },
  stat: { flex: 1, backgroundColor: colors.surface, borderRadius: radius.md, paddingVertical: space.md, alignItems: 'center' },
  statValue: { color: colors.text, fontSize: font.title, fontWeight: '800' },
  muted: { color: colors.textMuted, fontSize: font.small, textAlign: 'center' },
  list: { gap: space.xs },
  section: { color: colors.textMuted, fontSize: font.small, textTransform: 'uppercase', letterSpacing: 1, marginBottom: space.xs },
  attempt: { flexDirection: 'row', justifyContent: 'space-between', backgroundColor: colors.surface, borderRadius: radius.sm, padding: space.md },
  attemptText: { color: colors.text, fontSize: font.small },
  attemptResult: { fontSize: font.small, fontWeight: '700' },
  good: { color: colors.success },
  bad: { color: colors.danger },
});
