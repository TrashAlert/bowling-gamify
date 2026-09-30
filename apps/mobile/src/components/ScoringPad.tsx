import { type DeliveryInput, EMPTY, type NextDelivery, type PinMask, type PinNumber, pinBit } from '@bowling-rpg/scoring';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { primaryAction, toDelivery } from '@/features/live-scoring/entry';
import { useHaptics } from '@/features/settings/use-haptics';
import { colors, font, radius, space, touch } from '@/theme';
import { PinDeck } from './PinDeck';

export interface ScoringPadProps {
  readonly next: NextDelivery;
  readonly onRecord: (delivery: DeliveryInput) => void;
  readonly onUndo: () => void;
  readonly canUndo: boolean;
}

/**
 * Everything needed to log one ball. Remount it (via `key`) for each ball so the
 * selection starts empty. Nothing here animates or waits on I/O.
 */
export function ScoringPad({ next, onRecord, onUndo, canUndo }: ScoringPadProps) {
  const [selected, setSelected] = useState<PinMask>(EMPTY);
  const [foul, setFoul] = useState(false);
  const haptics = useHaptics();
  const action = primaryAction(next, selected, foul);

  const record = (leftStanding: PinMask) => {
    haptics.impact();
    onRecord(toDelivery(next.standing, leftStanding, foul));
  };
  const toggle = (pin: PinNumber) => setSelected((mask) => (mask ^ pinBit(pin)) as PinMask);

  return (
    <View style={styles.pad}>
      <Text style={styles.prompt}>
        Frame {next.frameNumber} · ball {next.deliveryInFrame} · tap pins still standing
      </Text>

      <PinDeck standing={next.standing} selected={selected} onToggle={toggle} />

      <View style={styles.row}>
        <SecondaryButton label="Undo" onPress={onUndo} disabled={!canUndo} />
        <SecondaryButton label={foul ? 'Foul ✓' : 'Foul'} onPress={() => setFoul((f) => !f)} active={foul} />
        <SecondaryButton label="Miss" onPress={() => record(next.standing)} />
      </View>

      <Pressable
        testID="record"
        onPress={() => record(selected)}
        accessibilityRole="button"
        accessibilityLabel={action.isSplit ? `${action.label}, split` : action.label}
        style={({ pressed }) => [styles.primary, pressed && styles.pressed]}
      >
        <Text style={styles.primaryText}>{action.label}</Text>
        {action.isSplit && <Text style={styles.splitBadge}>SPLIT</Text>}
      </Pressable>
    </View>
  );
}

interface SecondaryButtonProps {
  readonly label: string;
  readonly onPress: () => void;
  readonly disabled?: boolean;
  readonly active?: boolean;
}

function SecondaryButton({ label, onPress, disabled = false, active = false }: SecondaryButtonProps) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ disabled, selected: active }}
      style={({ pressed }) => [styles.secondary, active && styles.secondaryActive, disabled && styles.disabled, pressed && styles.pressed]}
    >
      <Text style={[styles.secondaryText, active && styles.secondaryTextActive]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pad: { gap: space.xl },
  prompt: { color: colors.textMuted, fontSize: font.small, textAlign: 'center' },
  row: { flexDirection: 'row', gap: space.md },
  primary: {
    minHeight: touch.primary,
    borderRadius: radius.lg,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: space.md,
  },
  primaryText: { color: colors.accentText, fontSize: font.title, fontWeight: '800' },
  splitBadge: {
    color: colors.accent,
    backgroundColor: colors.accentText,
    fontSize: font.small,
    fontWeight: '800',
    paddingHorizontal: space.sm,
    paddingVertical: 2,
    borderRadius: radius.sm,
    overflow: 'hidden',
  },
  secondary: {
    flex: 1,
    minHeight: touch.min + space.sm,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceRaised,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryActive: { backgroundColor: colors.danger },
  secondaryText: { color: colors.text, fontSize: font.body, fontWeight: '600' },
  secondaryTextActive: { color: colors.background },
  disabled: { opacity: 0.35 },
  pressed: { opacity: 0.8 },
});
