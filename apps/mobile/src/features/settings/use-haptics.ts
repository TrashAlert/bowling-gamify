import * as Haptics from 'expo-haptics';
import { useMemo } from 'react';
import { useSettings } from './settings-context';

export interface HapticFeedback {
  /** A pin tapped. */
  readonly selection: () => void;
  /** A ball recorded. */
  readonly impact: () => void;
  /** A level reached. */
  readonly success: () => void;
}

const SILENT: HapticFeedback = { selection: () => {}, impact: () => {}, success: () => {} };

const ON: HapticFeedback = {
  selection: () => void Haptics.selectionAsync(),
  impact: () => void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium),
  success: () => void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success),
};

/** Vibration that respects the Vibration setting. The only place the app calls expo-haptics. */
export function useHaptics(): HapticFeedback {
  const { haptics } = useSettings().settings;
  return useMemo(() => (haptics ? ON : SILENT), [haptics]);
}
