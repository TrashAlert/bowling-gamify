import { ROLLING_GAMES, compareForm } from '@bowling-rpg/progression';
import { useSQLiteContext } from 'expo-sqlite';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { ChartCard } from '@/components/ChartCard';
import { type ChartSeries, LineChart } from '@/components/LineChart';
import { StatTile } from '@/components/StatTile';
import { type ProgressPoint, gameStats, progressPoints } from '@/features/history/load';
import { useHistory } from '@/features/history/use-history';
import { PERCENT_SCALE, comparisonCaption, formTiles, scoreScale } from '@/features/progress/present';
import { formatDay } from '@/lib/format';
import { chart, colors, font, space } from '@/theme';

/** Games shown on the charts: enough to see a trend, few enough to read each dot. */
const CHART_GAMES = 30;

/** The long view: lifetime numbers, recent form against the games before, and trends. */
export default function ProgressScreen() {
  const history = useHistory(useSQLiteContext());
  if (!history) return <View style={styles.screen} />;

  const stats = gameStats(history);
  const points = progressPoints(history);
  const comparison = compareForm(points.map((p) => p.metrics));
  const recent = points.slice(-CHART_GAMES);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Progress</Text>

      <View style={styles.row}>
        <StatTile label="Games" value={String(stats.games)} />
        <StatTile label="Average" value={String(stats.average)} />
        <StatTile label="Best" value={String(stats.best)} />
      </View>

      {stats.games === 0 ? (
        <Text style={styles.note}>Finish a game to start seeing your stats and trends.</Text>
      ) : (
        <>
          <View style={styles.section}>
            <Text style={styles.sectionTitle} accessibilityRole="header">
              Recent form
            </Text>
            {comparison ? (
              <>
                <Text style={styles.caption}>{comparisonCaption(comparison)}</Text>
                <View style={styles.grid}>
                  {formTiles(comparison).map((tile) => (
                    <StatTile key={tile.label} label={tile.label} value={tile.value} delta={tile.delta} />
                  ))}
                </View>
              </>
            ) : (
              <Text style={styles.note}>Finish 4 games to compare your latest games with the ones before.</Text>
            )}
          </View>

          {recent.length < 2 ? (
            <Text style={styles.note}>Finish another game to see your trends.</Text>
          ) : (
            <>
              <ScoreChart points={recent} />
              <RatesChart points={recent} />
            </>
          )}
        </>
      )}
    </ScrollView>
  );
}

const rowLabel = (p: ProgressPoint) => `${formatDay(p.game.startedAt)} · G${p.game.gameNumber}`;
const asPercent = (rate: number | null) => (rate === null ? null : Math.round(rate * 100));

function ScoreChart({ points }: { points: readonly ProgressPoint[] }) {
  const averageLabel = `${ROLLING_GAMES}-game average`;
  const series: ChartSeries[] = [
    { key: 'score', label: 'Game', color: chart.context, mark: 'dots', values: points.map((p) => p.metrics.score) },
    { key: 'average', label: averageLabel, color: chart.series1, mark: 'line', values: points.map((p) => Math.round(p.rolling.average)) },
  ];
  const first = Math.round(points[0]!.rolling.average);
  const last = Math.round(points.at(-1)!.rolling.average);

  return (
    <ChartCard
      title="Score"
      subtitle={`Last ${points.length} games`}
      legend={series}
      table={{
        columns: ['Game', 'Score', averageLabel],
        rows: [...points].reverse().map((p) => [rowLabel(p), String(p.metrics.score), String(Math.round(p.rolling.average))]),
      }}
    >
      <LineChart
        series={series}
        xLabels={points.map(rowLabel)}
        scale={scoreScale(points.flatMap((p) => [p.metrics.score, p.rolling.average]))}
        format={(v) => String(Math.round(v))}
        summary={`Scores for your last ${points.length} games. Your ${averageLabel} went from ${first} to ${last}.`}
      />
    </ChartCard>
  );
}

function RatesChart({ points }: { points: readonly ProgressPoint[] }) {
  const series: ChartSeries[] = [
    { key: 'strikes', label: 'Strikes', color: chart.series1, mark: 'line', values: points.map((p) => asPercent(p.rolling.strikeRate)) },
    { key: 'spares', label: 'Spares', color: chart.series2, mark: 'line', values: points.map((p) => asPercent(p.rolling.spareRate)) },
  ];
  const cell = (v: number | null) => (v === null ? '—' : `${v}%`);

  return (
    <ChartCard
      title="Strikes and spares"
      subtitle={`Share of chances made, over ${ROLLING_GAMES} games at a time`}
      legend={series}
      table={{
        columns: ['Game', 'Strikes', 'Spares'],
        rows: [...points].reverse().map((p) => [rowLabel(p), cell(asPercent(p.rolling.strikeRate)), cell(asPercent(p.rolling.spareRate))]),
      }}
    >
      <LineChart
        series={series}
        xLabels={points.map(rowLabel)}
        scale={PERCENT_SCALE}
        format={(v) => `${Math.round(v)}%`}
        summary={`Strike and spare rates over your last ${points.length} games, ${ROLLING_GAMES} games at a time. Now ${cell(series[0]!.values.at(-1) ?? null)} strikes and ${cell(series[1]!.values.at(-1) ?? null)} spares.`}
      />
    </ChartCard>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: space.lg, gap: space.xl },
  title: { color: colors.text, fontSize: font.title, fontWeight: '800' },
  row: { flexDirection: 'row', gap: space.sm },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  section: { gap: space.sm },
  sectionTitle: { color: colors.textMuted, fontSize: font.small, textTransform: 'uppercase', letterSpacing: 1 },
  caption: { color: colors.textMuted, fontSize: font.small },
  note: { color: colors.textMuted, fontSize: font.body, lineHeight: 22 },
});
