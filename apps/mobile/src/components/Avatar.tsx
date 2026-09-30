import Ionicons from '@expo/vector-icons/Ionicons';
import { StyleSheet, Text, View } from 'react-native';
import { initials } from '@/features/profile/draft';
import { colors } from '@/theme';

/** The bowler's initials in a circle, or a person icon before they've set a name. */
export function Avatar({ name, size = 32 }: { name: string | null; size?: number }) {
  const letters = initials(name);
  return (
    <View style={[styles.circle, { width: size, height: size, borderRadius: size / 2 }]}>
      {letters ? (
        <Text style={[styles.letters, { fontSize: size * 0.4 }]}>{letters}</Text>
      ) : (
        <Ionicons name="person" size={size * 0.55} color={colors.accentText} testID="avatar-placeholder" />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  circle: { backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
  letters: { color: colors.accentText, fontWeight: '800' },
});
