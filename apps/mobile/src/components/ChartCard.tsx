import { type ReactNode, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors, font, radius, space } from '@/theme';
import { Key, type ChartSeries } from './LineChart';

export interface ChartTable {
  readonly columns: readonly string[];
  /** Already formatted, newest first. */
  readonly rows: readonly (readonly string[])[];
}

export interface ChartCardProps {
  readonly title: string;
  readonly subtitle?: string;
  /** Always shown for two or more series, so identity never rests on colour. */
  readonly legend: readonly Pick<ChartSeries, 'key' | 'label' | 'color' | 'mark'>[];
  /** The chart's numbers as a table: the accessible twin of the picture. */
  readonly table: ChartTable;
  readonly children: ReactNode;
}

export function ChartCard({ title, subtitle, legend, table, children }: ChartCardProps) {
  const [showTable, setShowTable] = useState(false);
  return (
    <View style={styles.card}>
      <View style={styles.head}>
        <Text style={styles.title} accessibilityRole="header">
          {title}
        </Text>
        {subtitle !== undefined && <Text style={styles.subtitle}>{subtitle}</Text>}
      </View>

      <View style={styles.legend}>
        {legend.map((item) => (
          <View key={item.key} style={styles.legendItem}>
            <Key color={item.color} mark={item.mark} />
            <Text style={styles.legendText}>{item.label}</Text>
          </View>
        ))}
      </View>

      {children}

      <Pressable
        onPress={() => setShowTable((shown) => !shown)}
        accessibilityRole="button"
        accessibilityState={{ expanded: showTable }}
        hitSlop={space.sm}
        style={styles.toggle}
      >
        <Text style={styles.toggleText}>{showTable ? 'Hide numbers' : 'Show numbers'}</Text>
      </Pressable>

      {showTable && (
        <ScrollView horizontal style={styles.table} contentContainerStyle={styles.tableContent}>
          <View>
            <Row cells={table.columns} header />
            {table.rows.map((row, i) => (
              <Row key={i} cells={row} />
            ))}
          </View>
        </ScrollView>
      )}
    </View>
  );
}

function Row({ cells, header = false }: { cells: readonly string[]; header?: boolean }) {
  return (
    <View style={styles.row} accessible accessibilityRole={header ? 'header' : undefined}>
      {cells.map((cell, i) => (
        <Text key={i} style={[styles.cell, i > 0 && styles.numeric, header && styles.headerCell]}>
          {cell}
        </Text>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: space.lg, gap: space.md },
  head: { gap: 2 },
  title: { color: colors.text, fontSize: font.body, fontWeight: '800' },
  subtitle: { color: colors.textMuted, fontSize: font.small },
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: space.lg },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
  legendText: { color: colors.textMuted, fontSize: font.small },
  toggle: { alignSelf: 'flex-start' },
  toggleText: { color: colors.text, fontSize: font.small, fontWeight: '700', textDecorationLine: 'underline' },
  table: { marginTop: -space.xs },
  tableContent: { paddingBottom: space.xs },
  row: { flexDirection: 'row', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border, paddingVertical: space.xs },
  cell: { width: 96, color: colors.text, fontSize: font.small },
  numeric: { width: 72, textAlign: 'right', fontVariant: ['tabular-nums'] },
  headerCell: { color: colors.textMuted, fontWeight: '700' },
});
