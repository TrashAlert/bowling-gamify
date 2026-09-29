import { toPinMask } from '@bowling-rpg/scoring';
import { z } from 'zod';

/** Server-issued row IDs. Branded so a session ID can never be passed where a user ID belongs. */
export const UserId = z.uuid().brand<'UserId'>();
export const SessionId = z.uuid().brand<'SessionId'>();
export const BallId = z.uuid().brand<'BallId'>();
export const HouseId = z.uuid().brand<'HouseId'>();
export const OilPatternId = z.uuid().brand<'OilPatternId'>();

/**
 * A session's ID as generated on the phone (UUIDv7), before the server has seen it.
 * `(user_id, client_id)` is the sync idempotency key.
 */
export const ClientSessionId = z.uuid().brand<'ClientSessionId'>();

export type UserId = z.infer<typeof UserId>;
export type SessionId = z.infer<typeof SessionId>;
export type BallId = z.infer<typeof BallId>;
export type HouseId = z.infer<typeof HouseId>;
export type OilPatternId = z.infer<typeof OilPatternId>;
export type ClientSessionId = z.infer<typeof ClientSessionId>;

/** A 10-bit pin mask (0-1023), parsed into the scoring package's branded type. */
export const PinMaskSchema = z.int().min(0).max(1023).transform((n) => toPinMask(n));

/** ISO 8601 with an explicit offset. Phones in a bowling alley have no reliable clock sync, so keep the offset. */
export const Timestamp = z.iso.datetime({ offset: true });
