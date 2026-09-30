import { Stack, router } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { FormField, HeaderButton } from '@/components/FormField';
import type { Hand } from '@/db/profile';
import { type DraftErrors, type ProfileDraft, LIMITS, draftFrom, parseDraft } from '@/features/profile/draft';
import { useProfile } from '@/features/profile/profile-context';
import { colors, font, radius, space, touch } from '@/theme';

const HANDS: readonly { value: Hand; label: string }[] = [
  { value: 'right', label: 'Right' },
  { value: 'left', label: 'Left' },
];

export default function EditProfileScreen() {
  const { profile, save } = useProfile();
  const [draft, setDraft] = useState<ProfileDraft>(() => draftFrom(profile));
  const [errors, setErrors] = useState<DraftErrors>({});
  const [saving, setSaving] = useState(false);

  const set = <K extends keyof ProfileDraft>(key: K, value: ProfileDraft[K]) => {
    setDraft((current) => ({ ...current, [key]: value }));
    // Clear a field's error as soon as it's edited; the rest stay until Save.
    if (key in errors) setErrors(({ [key as keyof DraftErrors]: _, ...rest }) => rest);
  };

  const submit = async () => {
    const result = parseDraft(draft);
    if (!result.ok) return setErrors(result.errors);
    setSaving(true);
    try {
      await save(result.profile);
      router.back();
    } finally {
      setSaving(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Stack.Screen
        options={{
          headerLeft: () => <HeaderButton label="Cancel" onPress={() => router.back()} />,
          headerRight: () => <HeaderButton label="Save" onPress={() => void submit()} disabled={saving} bold />,
        }}
      />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <FormField
          label="Name"
          value={draft.displayName}
          onChangeText={(text) => set('displayName', text)}
          placeholder="What should we call you?"
          maxLength={LIMITS.displayName}
          autoCapitalize="words"
          returnKeyType="done"
          error={errors.displayName}
        />

        <View style={styles.field}>
          <Text style={styles.label}>Bowling hand</Text>
          <View style={styles.pills} accessibilityRole="radiogroup">
            {HANDS.map(({ value, label }) => {
              const selected = draft.hand === value;
              return (
                <Pressable
                  key={value}
                  // Tapping the selected hand again clears it.
                  onPress={() => set('hand', selected ? null : value)}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: selected }}
                  style={[styles.pill, selected && styles.pillSelected]}
                >
                  <Text style={[styles.pillText, selected && styles.pillTextSelected]}>{label}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <Text style={styles.section} accessibilityRole="header">
          Favourite ball
        </Text>
        <FormField
          label="Ball name"
          value={draft.ballName}
          onChangeText={(text) => set('ballName', text)}
          placeholder="e.g. Phaze II"
          maxLength={LIMITS.ballName}
          error={errors.ballName}
        />
        <FormField
          label="Brand"
          value={draft.ballBrand}
          onChangeText={(text) => set('ballBrand', text)}
          placeholder="Optional"
          maxLength={LIMITS.ballBrand}
          error={errors.ballBrand}
        />
        <FormField
          label="Weight (lb)"
          value={draft.ballWeight}
          onChangeText={(text) => set('ballWeight', text)}
          placeholder="Optional"
          keyboardType="number-pad"
          maxLength={2}
          hint={`${LIMITS.minWeight} to ${LIMITS.maxWeight} lb`}
          error={errors.ballWeight}
        />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: space.lg, gap: space.lg },
  field: { gap: space.xs },
  label: { color: colors.textMuted, fontSize: font.small, fontWeight: '600' },
  section: { color: colors.textMuted, fontSize: font.small, textTransform: 'uppercase', letterSpacing: 1, marginTop: space.md },
  pills: { flexDirection: 'row', gap: space.sm },
  pill: {
    flex: 1,
    minHeight: touch.min,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pillSelected: { backgroundColor: colors.accent, borderColor: colors.accent },
  pillText: { color: colors.text, fontSize: font.body, fontWeight: '600' },
  pillTextSelected: { color: colors.accentText },
});
