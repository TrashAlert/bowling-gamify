import type { LevelProgress } from '@bowling-rpg/progression';
import { useEffect, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, StyleSheet, Text, View } from 'react-native';
import { colors, font, radius, space } from '@/theme';

export interface XpBarProps {
  readonly progress: LevelProgress;
  /** Fraction to fill from, for the after-game animation. Omit to show the bar at rest. */
  readonly animateFrom?: number;
}

/** Progress through the current level. Animates when asked, unless the phone asks for reduced motion. */
export function XpBar({ progress, animateFrom }: XpBarProps) {
  const [fill] = useState(() => new Animated.Value(animateFrom ?? progress.fraction));

  useEffect(() => {
    let cancelled = false;
    void AccessibilityInfo.isReduceMotionEnabled().then((reduce) => {
      if (cancelled) return;
      if (reduce) fill.setValue(progress.fraction);
      else Animated.timing(fill, { toValue: progress.fraction, duration: 900, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start();
    });
    return () => {
      cancelled = true;
    };
  }, [fill, progress.fraction]);

  return (
    <View style={styles.wrap}>
      <View style={styles.labels}>
        <Text style={styles.level}>Level {progress.level}</Text>
        <Text style={styles.count}>
          {progress.xpIntoLevel} / {progress.levelSize} XP
        </Text>
      </View>
      <View
        style={styles.track}
        accessibilityRole="progressbar"
        accessibilityLabel={`Level ${progress.level}`}
        accessibilityValue={{ min: 0, max: progress.levelSize, now: progress.xpIntoLevel, text: `${progress.xpToNext} XP to level ${progress.level + 1}` }}
      >
        <Animated.View style={[styles.fill, { width: fill.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }) }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space.xs },
  labels: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  level: { color: colors.text, fontSize: font.body, fontWeight: '800' },
  count: { color: colors.textMuted, fontSize: font.small, fontWeight: '600' },
  track: { height: 12, borderRadius: radius.pill, backgroundColor: colors.surfaceRaised, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: radius.pill, backgroundColor: colors.accent },
});
