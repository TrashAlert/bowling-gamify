import { useSQLiteContext } from 'expo-sqlite';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { LevelCard } from '@/components/LevelCard';
import { gameStats } from '@/features/history/load';
import { useHistory } from '@/features/history/use-history';
import { colors, font, radius, space } from '@/theme';

/** The long view: level and lifetime numbers. The list of games lives on Home. */
export default function ProgressScreen() {
  const history = useHistory(useSQLiteContext());
  if (!history) return <View style={styles.screen} />;

  const stats = gameStats(history);
  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Progress</Text>
      <LevelCard progress={history.progression.current} />
      <View style={styles.stats}>
        <Stat label="Games" value={String(stats.games)} />
        <Stat label="Average" value={String(stats.average)} />
        <Stat label="Best" value={String(stats.best)} />
      </View>
      {stats.games === 0 && (
        <Text style={styles.empty}>Every finished game earns its score in XP, up to 300 for a perfect game. Bowl one to start levelling.</Text>
      )}
    </ScrollView>
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
  content: { padding: space.lg, gap: space.lg },
  title: { color: colors.text, fontSize: font.title, fontWeight: '800' },
  stats: { flexDirection: 'row', gap: space.sm },
  stat: { flex: 1, backgroundColor: colors.surface, borderRadius: radius.md, paddingVertical: space.md, alignItems: 'center' },
  statValue: { color: colors.text, fontSize: font.title, fontWeight: '800' },
  statLabel: { color: colors.textMuted, fontSize: font.small },
  empty: { color: colors.textMuted, fontSize: font.body, lineHeight: 22, textAlign: 'center' },
});
