import { type PinMask, type PinNumber, formatPins, isStanding } from '@bowling-rpg/scoring';
import { StyleSheet, View } from 'react-native';
import { colors } from '@/theme';

const ROWS: readonly (readonly PinNumber[])[] = [[7, 8, 9, 10], [4, 5, 6], [2, 3], [1]];

/** A leave at a glance: standing pins filled, the rest as outlines. Read-only. */
export function MiniRack({ leave, size = 8 }: { leave: PinMask; size?: number }) {
  const gap = size / 2;
  return (
    <View style={{ gap, alignItems: 'center' }} accessible accessibilityLabel={`Leave ${formatPins(leave)}`}>
      {ROWS.map((row) => (
        <View key={row[0]} style={{ flexDirection: 'row', gap }}>
          {row.map((pin) => (
            <View
              key={pin}
              style={[
                styles.pin,
                { width: size, height: size, borderRadius: size / 2 },
                isStanding(leave, pin) ? styles.standing : styles.down,
              ]}
            />
          ))}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  pin: { borderWidth: 1 },
  standing: { backgroundColor: colors.pinUp, borderColor: colors.pinUp },
  down: { borderColor: colors.border },
});
