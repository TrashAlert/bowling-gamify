import { StyleSheet, Text, View } from 'react-native';
import type { Delta } from '@/features/progress/present';
import { colors, font, radius, space } from '@/theme';

export interface StatTileProps {
  readonly label: string;
  readonly value: string;
  /** Change against an earlier stretch. Arrow and sign carry it; colour only reinforces. */
  readonly delta?: Delta | undefined;
}

/** A number with its label, and optionally how it moved. */
export function StatTile({ label, value, delta }: StatTileProps) {
  const spoken = delta ? `${label} ${value}, ${delta.text.replace('▲', 'up').replace('▼', 'down')}, ${delta.direction}` : `${label} ${value}`;
  return (
    <View style={styles.tile} accessible accessibilityLabel={spoken}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>{value}</Text>
      {delta && <Text style={[styles.delta, styles[delta.direction]]}>{delta.text}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  tile: { flex: 1, minWidth: '40%', backgroundColor: colors.surface, borderRadius: radius.md, padding: space.md, gap: 2 },
  label: { color: colors.textMuted, fontSize: font.small },
  value: { color: colors.text, fontSize: font.title, fontWeight: '800' },
  delta: { fontSize: font.small, fontWeight: '700' },
  better: { color: colors.success },
  worse: { color: colors.danger },
  same: { color: colors.textMuted },
});
