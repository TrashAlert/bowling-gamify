import Ionicons from '@expo/vector-icons/Ionicons';
import { StyleSheet, Text, View } from 'react-native';
import { colors, font, radius, space } from '@/theme';

/**
 * PLACEHOLDER for scanning the lane's score screen instead of tapping each
 * ball. Deliberately not tappable until it works. The plan, and the data-model
 * change it needs (balls with a count but no pins), is docs/adr/0002.
 */
export function ScanScoresheetCard() {
  return (
    <View
      style={styles.card}
      accessible
      accessibilityLabel="Scan scoresheet. Take a photo of the lane's screen instead of tapping each ball. Coming soon."
    >
      <View style={styles.icon}>
        <Ionicons name="camera-outline" size={22} color={colors.textMuted} />
      </View>
      <View style={styles.text}>
        <View style={styles.titleLine}>
          <Text style={styles.title}>Scan scoresheet</Text>
          <Text style={styles.soon}>Coming soon</Text>
        </View>
        <Text style={styles.description}>Take a photo of the lane’s screen instead of tapping each ball.</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: space.md,
  },
  icon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surfaceRaised,
    alignItems: 'center',
    justifyContent: 'center',
    opacity: 0.7,
  },
  text: { flex: 1, gap: 2 },
  titleLine: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  title: { color: colors.textMuted, fontSize: font.body, fontWeight: '700' },
  soon: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '700',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.pill,
    paddingHorizontal: space.sm,
    paddingVertical: 1,
    overflow: 'hidden',
  },
  description: { color: colors.textMuted, fontSize: font.small },
});
