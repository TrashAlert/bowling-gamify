import type { Hand, Profile } from '@/db/profile';

export const LIMITS = { displayName: 30, ballName: 40, ballBrand: 40, minWeight: 6, maxWeight: 16 } as const;

/** The edit form's state: every field as typed, before validation. */
export interface ProfileDraft {
  readonly displayName: string;
  readonly hand: Hand | null;
  readonly ballName: string;
  readonly ballBrand: string;
  readonly ballWeight: string;
}

export type DraftField = 'displayName' | 'ballName' | 'ballBrand' | 'ballWeight';
export type DraftErrors = Partial<Record<DraftField, string>>;

export function draftFrom(profile: Profile): ProfileDraft {
  return {
    displayName: profile.displayName ?? '',
    hand: profile.hand,
    ballName: profile.ball?.name ?? '',
    ballBrand: profile.ball?.brand ?? '',
    ballWeight: profile.ball?.weightLb == null ? '' : String(profile.ball.weightLb),
  };
}

/**
 * Checks a draft and turns it into a profile. Blank fields mean "not set";
 * leading and trailing spaces are dropped. Messages say how to fix the field.
 */
export function parseDraft(draft: ProfileDraft): { ok: true; profile: Profile } | { ok: false; errors: DraftErrors } {
  const displayName = draft.displayName.trim();
  const ballName = draft.ballName.trim();
  const ballBrand = draft.ballBrand.trim();
  const weightText = draft.ballWeight.trim();
  const errors: DraftErrors = {};

  if (displayName.length > LIMITS.displayName) errors.displayName = `Keep it to ${LIMITS.displayName} characters.`;
  if (ballName.length > LIMITS.ballName) errors.ballName = `Keep it to ${LIMITS.ballName} characters.`;
  if (ballBrand.length > LIMITS.ballBrand) errors.ballBrand = `Keep it to ${LIMITS.ballBrand} characters.`;

  let weightLb: number | null = null;
  if (weightText !== '') {
    weightLb = /^\d{1,2}$/.test(weightText) ? Number(weightText) : NaN;
    if (!(weightLb >= LIMITS.minWeight && weightLb <= LIMITS.maxWeight)) {
      errors.ballWeight = `Enter a whole number from ${LIMITS.minWeight} to ${LIMITS.maxWeight}.`;
    }
  }
  if (ballName === '' && (ballBrand !== '' || weightText !== '')) errors.ballName = 'Give the ball a name.';

  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return {
    ok: true,
    profile: {
      displayName: displayName || null,
      hand: draft.hand,
      ball: ballName ? { name: ballName, brand: ballBrand || null, weightLb } : null,
    },
  };
}

/** "Syahmi Samad" → "SS", "syah" → "S"; null when there's no name to draw from. */
export function initials(name: string | null): string | null {
  const words = (name ?? '').trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return null;
  return words
    .slice(0, 2)
    .map((word) => [...word][0]!.toUpperCase())
    .join('');
}
