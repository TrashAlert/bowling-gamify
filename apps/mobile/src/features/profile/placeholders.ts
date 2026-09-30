import type Ionicons from '@expo/vector-icons/Ionicons';
import type { ComponentProps } from 'react';

type IconName = ComponentProps<typeof Ionicons>['name'];

/**
 * PLACEHOLDERS. Badges and achievements are shown locked, with no logic behind
 * them yet. The names are draft copy: rename, add or remove freely. When they
 * become real, each needs a rule over the stored balls (like XP does) and an
 * unlocked state; nothing else on the screen has to change.
 */

export interface Badge {
  readonly key: string;
  readonly name: string;
  readonly icon: IconName;
}

export const BADGES: readonly Badge[] = [
  { key: 'first-strike', name: 'First Strike', icon: 'flash' },
  { key: 'turkey', name: 'Turkey', icon: 'flame' },
  { key: 'clean-game', name: 'Clean Game', icon: 'sparkles' },
  { key: '200-club', name: '200 Club', icon: 'ribbon' },
  { key: 'spare-hunter', name: 'Spare Hunter', icon: 'locate' },
  { key: 'perfect-game', name: 'Perfect Game', icon: 'trophy' },
];

export interface Achievement {
  readonly key: string;
  readonly name: string;
  readonly description: string;
}

export const ACHIEVEMENTS: readonly Achievement[] = [
  { key: 'games-10', name: 'Regular', description: 'Finish 10 games.' },
  { key: 'spares-50', name: 'Clean-up Crew', description: 'Convert 50 spares.' },
  { key: 'score-200', name: 'Double Century', description: 'Score 200 or more.' },
  { key: 'strikes-3', name: 'Turkey Shoot', description: 'Throw three strikes in a row.' },
  { key: 'no-opens', name: 'Spotless', description: 'Finish a game with no open frames.' },
  { key: 'level-10', name: 'Veteran', description: 'Reach level 10.' },
];
