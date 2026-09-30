import { conversionRate } from '@bowling-rpg/progression';
import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MonsterRow } from '@/components/MonsterRow';
import { useHistory } from '@/features/history/use-history';
import { formatPercent } from '@/lib/format';
import { colors, font, space } from '@/theme';

export default function BestiaryScreen() {
  const data = useHistory(useSQLiteContext());
  const entries = data?.bestiary ?? [];
  const faced = entries.reduce((sum, e) => sum + e.attempts, 0);
  const slain = entries.reduce((sum, e) => sum + e.conversions, 0);

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <FlatList
        data={entries}
        keyExtractor={(e) => String(e.leave)}
        contentContainerStyle={styles.content}
        ListHeaderComponent={
          <View style={styles.header}>
            <Text style={styles.title}>Bestiary</Text>
            {entries.length > 0 && (
              <Text style={styles.summary}>
                {entries.length} monsters discovered · {slain} of {faced} slain ({formatPercent(conversionRate({ attempts: faced, conversions: slain }))})
              </Text>
            )}
          </View>
        }
        ListEmptyComponent={
          data ? (
            <Text style={styles.empty}>
              Every leave you have to spare becomes a monster here. Knock it down with your next ball to slay it. Bowl a game to meet
              your first.
            </Text>
          ) : null
        }
        renderItem={({ item }) => (
          <MonsterRow
            leave={item.leave}
            name={item.name}
            tier={item.tier}
            detail={`${item.conversions}/${item.attempts} · ${formatPercent(conversionRate(item))}`}
            onPress={() => router.push(`/leave/${item.leave}`)}
          />
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: space.lg, gap: space.sm },
  header: { gap: space.xs, marginTop: space.lg, marginBottom: space.md },
  title: { color: colors.text, fontSize: font.title, fontWeight: '800' },
  summary: { color: colors.textMuted, fontSize: font.small },
  empty: { color: colors.textMuted, fontSize: font.body, lineHeight: 22, marginTop: space.lg },
});
