/**
 * Design tokens. Dark by default: this app is used in a dark bowling alley.
 * No colour, size or spacing value appears anywhere else in the app.
 */
export const colors = {
  background: '#0B0E14',
  surface: '#161B26',
  surfaceRaised: '#1F2633',
  border: '#2C3545',
  text: '#F2F4F8',
  textMuted: '#8A94A6',
  accent: '#F5B83D',
  accentText: '#1A1204',
  pinUp: '#F2F4F8',
  pinDown: '#2C3545',
  danger: '#F2665C',
  warning: '#F5B83D',
  success: '#5CD18A',
} as const;

/**
 * Chart colours. The two series were checked with the dataviz palette validator
 * against `colors.surface` (the chart card): colour-blind ΔE 26.8, normal-vision
 * ΔE 31.8, both ≥ 3:1 contrast. Re-run it if either value or the surface changes.
 * Series 1 is the story; `context` is for marks that are background to it.
 */
export const chart = {
  series1: '#3987e5',
  series2: '#d95926',
  context: colors.textMuted,
  grid: colors.border,
  axisText: colors.textMuted,
  crosshair: colors.textMuted,
} as const;

/** Monster tiers, 1 (Minion) to 5 (Boss). Always shown with the tier name too, never by colour alone. */
export const tierColors = {
  1: '#8A94A6',
  2: '#5CD18A',
  3: '#5AA9F2',
  4: '#B38BF5',
  5: '#F5B83D',
} as const;

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;

export const radius = { sm: 6, md: 12, lg: 20, pill: 999 } as const;

export const font = {
  small: 13,
  body: 16,
  title: 22,
  score: 44,
} as const;

/** Apple's minimum touch target is 44pt. Pins and the main button are far bigger. */
export const touch = { min: 44, pin: 60, primary: 72 } as const;
