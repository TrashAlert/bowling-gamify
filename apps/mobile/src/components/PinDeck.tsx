import { type PinMask, type PinNumber, isStanding } from '@bowling-rpg/scoring';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useHaptics } from '@/features/settings/use-haptics';
import { colors, font, radius, space, touch } from '@/theme';

/** Back row first, as the bowler sees the rack from the approach. */
const ROWS: readonly (readonly PinNumber[])[] = [[7, 8, 9, 10], [4, 5, 6], [2, 3], [1]];

export interface PinDeckProps {
  /** Pins standing before this ball. The rest are already down and can't be tapped. */
  readonly standing: PinMask;
  /** Pins the bowler has marked as still standing after this ball. */
  readonly selected: PinMask;
  readonly onToggle: (pin: PinNumber) => void;
}

/**
 * The rack as ten large tap targets. Plain native views rather than a canvas,
 * so each pin is a real accessible checkbox for VoiceOver and TalkBack.
 */
export function PinDeck({ standing, selected, onToggle }: PinDeckProps) {
  const haptics = useHaptics();
  return (
    <View style={styles.deck} accessibilityRole="none">
      {ROWS.map((row) => (
        <View key={row[0]} style={styles.row}>
          {row.map((pin) => {
            const available = isStanding(standing, pin);
            const marked = isStanding(selected, pin);
            return (
              <Pressable
                key={pin}
                testID={`pin-${pin}`}
                disabled={!available}
                onPress={() => {
                  haptics.selection();
                  onToggle(pin);
                }}
                hitSlop={space.xs}
                accessibilityRole="checkbox"
                accessibilityLabel={`Pin ${pin}`}
                accessibilityHint={available ? 'Marks the pin as still standing' : undefined}
                accessibilityState={{ checked: marked, disabled: !available }}
                style={({ pressed }) => [
                  styles.pin,
                  !available && styles.pinGone,
                  marked && styles.pinStanding,
                  pressed && styles.pinPressed,
                ]}
              >
                <Text style={[styles.label, marked && styles.labelStanding, !available && styles.labelGone]}>{pin}</Text>
              </Pressable>
            );
          })}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  deck: { alignItems: 'center', gap: space.md },
  row: { flexDirection: 'row', gap: space.md },
  pin: {
    width: touch.pin,
    height: touch.pin,
    borderRadius: radius.pill,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pinStanding: { backgroundColor: colors.pinUp, borderColor: colors.pinUp },
  pinGone: { opacity: 0.25, borderStyle: 'dashed' },
  pinPressed: { transform: [{ scale: 0.94 }] },
  label: { color: colors.textMuted, fontSize: font.body, fontWeight: '600' },
  labelStanding: { color: colors.background },
  labelGone: { color: colors.pinDown },
});
