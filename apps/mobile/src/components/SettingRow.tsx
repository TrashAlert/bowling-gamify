import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { colors, font, radius, space, touch } from '@/theme';

interface RowText {
  readonly label: string;
  readonly description?: string | undefined;
}

/** An on/off setting. The whole row is the switch's label for screen readers. */
export function SwitchRow({ label, description, value, onChange }: RowText & { value: boolean; onChange: (value: boolean) => void }) {
  return (
    <View style={styles.row}>
      <RowLabel label={label} description={description} />
      <Switch
        value={value}
        onValueChange={onChange}
        accessibilityLabel={label}
        trackColor={{ false: colors.surfaceRaised, true: colors.accent }}
        thumbColor={colors.text}
      />
    </View>
  );
}

/** A row that does something when tapped: export, delete. */
export function ActionRow({
  label,
  description,
  onPress,
  destructive = false,
  disabled = false,
}: RowText & { onPress: () => void; destructive?: boolean; disabled?: boolean }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      style={({ pressed }) => [styles.row, disabled && styles.disabled, pressed && { opacity: 0.8 }]}
    >
      <RowLabel label={label} description={description} destructive={destructive} />
    </Pressable>
  );
}

/** A read-only line, e.g. the app version. */
export function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row} accessible accessibilityLabel={`${label}: ${value}`}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>{value}</Text>
    </View>
  );
}

export function SettingsSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle} accessibilityRole="header">
        {title}
      </Text>
      <View style={styles.group}>{children}</View>
    </View>
  );
}

function RowLabel({ label, description, destructive = false }: RowText & { destructive?: boolean }) {
  return (
    <View style={styles.text}>
      <Text style={[styles.label, destructive && styles.destructive]}>{label}</Text>
      {description !== undefined && <Text style={styles.description}>{description}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: space.sm },
  sectionTitle: { color: colors.textMuted, fontSize: font.small, textTransform: 'uppercase', letterSpacing: 1 },
  group: { backgroundColor: colors.surface, borderRadius: radius.md, overflow: 'hidden' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.lg,
    minHeight: touch.min + space.md,
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  text: { flex: 1, gap: 2 },
  label: { color: colors.text, fontSize: font.body, fontWeight: '600' },
  description: { color: colors.textMuted, fontSize: font.small, lineHeight: 18 },
  value: { color: colors.textMuted, fontSize: font.body },
  destructive: { color: colors.danger },
  disabled: { opacity: 0.4 },
});
