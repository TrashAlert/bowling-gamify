import { Pressable, StyleSheet, Text, TextInput, type TextInputProps, View } from 'react-native';
import { colors, font, radius, space, touch } from '@/theme';

export interface FormFieldProps extends Omit<TextInputProps, 'style' | 'placeholderTextColor'> {
  readonly label: string;
  readonly hint?: string;
  readonly error?: string | undefined;
}

/** A labelled text input. The error replaces the hint, and is announced with the label. */
export function FormField({ label, hint, error, ...input }: FormFieldProps) {
  const note = error ?? hint;
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        {...input}
        accessibilityLabel={label}
        accessibilityHint={error ?? hint}
        placeholderTextColor={colors.textMuted}
        style={[styles.input, error !== undefined && styles.inputError]}
      />
      {note !== undefined && <Text style={[styles.note, error !== undefined && styles.error]}>{note}</Text>}
    </View>
  );
}

/** Text button for a navigation header: Edit, Save, Cancel. */
export function HeaderButton({ label, onPress, disabled = false, bold = false }: { label: string; onPress: () => void; disabled?: boolean; bold?: boolean }) {
  return (
    <Pressable onPress={onPress} disabled={disabled} accessibilityRole="button" hitSlop={space.sm} style={styles.headerButton}>
      <Text style={[styles.headerText, bold && styles.headerBold, disabled && { opacity: 0.4 }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  field: { gap: space.xs },
  label: { color: colors.textMuted, fontSize: font.small, fontWeight: '600' },
  input: {
    minHeight: touch.min + space.xs,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: space.md,
    color: colors.text,
    fontSize: font.body,
  },
  inputError: { borderColor: colors.danger },
  note: { color: colors.textMuted, fontSize: font.small },
  error: { color: colors.danger },
  headerButton: { minHeight: touch.min, justifyContent: 'center', paddingHorizontal: space.sm },
  headerText: { color: colors.accent, fontSize: font.body },
  headerBold: { fontWeight: '700' },
});
