import type { Db } from './games';

export type Hand = 'right' | 'left';

export interface FavouriteBall {
  readonly name: string;
  readonly brand: string | null;
  /** 6 to 16 lb, the legal range. */
  readonly weightLb: number | null;
}

export interface Profile {
  readonly displayName: string | null;
  readonly hand: Hand | null;
  readonly ball: FavouriteBall | null;
}

export const EMPTY_PROFILE: Profile = { displayName: null, hand: null, ball: null };

interface Row {
  display_name: string | null;
  hand: Hand | null;
  ball_name: string | null;
  ball_brand: string | null;
  ball_weight_lb: number | null;
}

export async function fetchProfile(db: Db): Promise<Profile> {
  const row = await db.getFirstAsync<Row>('SELECT display_name, hand, ball_name, ball_brand, ball_weight_lb FROM profile WHERE id = 1');
  if (!row) return EMPTY_PROFILE;
  return {
    displayName: row.display_name,
    hand: row.hand,
    ball: row.ball_name === null ? null : { name: row.ball_name, brand: row.ball_brand, weightLb: row.ball_weight_lb },
  };
}

/** Replaces the whole profile. Validate first: the table's CHECKs are the last line, not the first. */
export async function saveProfile(db: Db, profile: Profile): Promise<void> {
  await db.runAsync(
    `INSERT INTO profile (id, display_name, hand, ball_name, ball_brand, ball_weight_lb) VALUES (1, ?, ?, ?, ?, ?)
     ON CONFLICT (id) DO UPDATE SET
       display_name = excluded.display_name, hand = excluded.hand,
       ball_name = excluded.ball_name, ball_brand = excluded.ball_brand, ball_weight_lb = excluded.ball_weight_lb`,
    profile.displayName,
    profile.hand,
    profile.ball?.name ?? null,
    profile.ball?.brand ?? null,
    profile.ball?.weightLb ?? null,
  );
}
