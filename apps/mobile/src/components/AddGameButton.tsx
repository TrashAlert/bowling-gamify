import Ionicons from '@expo/vector-icons/Ionicons';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Pressable, StyleSheet, View } from 'react-native';
import { colors, radius, touch } from '@/theme';

export interface AddGameButtonProps {
  /** 'paused' while a started game is waiting to be continued or stopped. */
  readonly mode: 'add' | 'paused';
  readonly onPress: () => void;
}

/** The tab bar's centre button: "+" to start bowling, play/pause while a game is left unfinished. */
export function AddGameButton({ mode, onPress }: AddGameButtonProps) {
  const paused = mode === 'paused';
  return (
    <View style={styles.slot}>
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={paused ? 'Game in progress' : 'Add game'}
        accessibilityHint={paused ? 'Continue or stop your unfinished game' : 'Starts a game'}
        style={({ pressed }) => [styles.button, pressed && styles.pressed]}
      >
        {paused ? (
          <MaterialCommunityIcons name="play-pause" size={30} color={colors.accentText} testID="icon-play-pause" />
        ) : (
          <Ionicons name="add" size={32} color={colors.accentText} testID="icon-add" />
        )}
      </Pressable>
    </View>
  );
}

const SIZE = touch.min + 8;

const styles = StyleSheet.create({
  slot: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  button: {
    width: SIZE,
    height: SIZE,
    borderRadius: radius.pill,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: { opacity: 0.85, transform: [{ scale: 0.95 }] },
});
