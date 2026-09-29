import { sql } from 'drizzle-orm';
import {
  bigint,
  boolean,
  char,
  check,
  foreignKey,
  index,
  inet,
  integer,
  jsonb,
  numeric,
  pgTable,
  primaryKey,
  smallint,
  text,
  timestamp,
  unique,
  uuid,
} from 'drizzle-orm/pg-core';
import { authUsers } from 'drizzle-orm/supabase';
import { Hand, MaintenanceKind, OilPatternCategory, XpSource, checkIn } from './enums';

/**
 * Conventions:
 * - Every table has row-level security enabled and no policies. The API is the
 *   only client and connects as the table owner; RLS is the second line of
 *   defence that stops anything reaching these tables through PostgREST.
 * - Pin fields are 10-bit masks (pin N is bit N-1), CHECKed to 0..1023.
 * - `user_id` is denormalised onto games, frames and throws. A composite
 *   foreign key `(parent_id, user_id)` makes it impossible for a child row's
 *   user to differ from its parent's, so filtering by it can never leak rows.
 */

const id = () => uuid('id').primaryKey().defaultRandom();
const timestamptz = (name: string) => timestamp(name, { withTimezone: true });
const createdAt = () => timestamptz('created_at').notNull().defaultNow();
const ownedBy = () => uuid('user_id').notNull().references(() => authUsers.id, { onDelete: 'cascade' });
const pinMaskInRange = (column: unknown) => sql`${column} BETWEEN 0 AND 1023`;

// ---------------------------------------------------------------- reference

/** Bowling centres. Shared across users; deleting one never cascades into anybody's history. */
export const houses = pgTable(
  'houses',
  {
    id: id(),
    name: text('name').notNull(),
    country: char('country', { length: 2 }).notNull(),
    city: text('city'),
    laneCount: smallint('lane_count'),
    createdAt: createdAt(),
  },
  (t) => [
    check('houses_country_iso', sql`${t.country} ~ '^[A-Z]{2}$'`),
    check('houses_lane_count_range', sql`${t.laneCount} BETWEEN 1 AND 200`),
  ],
).enableRLS();

export const oilPatterns = pgTable(
  'oil_patterns',
  {
    id: id(),
    name: text('name').notNull().unique(),
    category: smallint('category').notNull(),
    lengthFt: smallint('length_ft'),
    volumeMl: numeric('volume_ml', { precision: 5, scale: 2 }),
    ratio: numeric('ratio', { precision: 4, scale: 1 }),
  },
  (t) => [
    check('oil_patterns_category_valid', sql`${t.category} IN (${sql.raw(checkIn(OilPatternCategory))})`),
    check('oil_patterns_length_range', sql`${t.lengthFt} BETWEEN 20 AND 70`),
  ],
).enableRLS();

// ---------------------------------------------------------------- identity

export const profiles = pgTable(
  'profiles',
  {
    userId: uuid('user_id')
      .primaryKey()
      .references(() => authUsers.id, { onDelete: 'cascade' }),
    /** Lowercase only, so plain uniqueness is case-insensitive without citext. */
    handle: text('handle').notNull().unique(),
    displayName: text('display_name').notNull(),
    avatarPath: text('avatar_path'),
    hand: smallint('hand'),
    homeHouseId: uuid('home_house_id').references(() => houses.id, { onDelete: 'set null' }),
    createdAt: createdAt(),
  },
  (t) => [
    check('profiles_handle_format', sql`${t.handle} ~ '^[a-z0-9_]{3,20}$'`),
    check('profiles_display_name_length', sql`char_length(${t.displayName}) BETWEEN 1 AND 50`),
    check('profiles_hand_valid', sql`${t.hand} IN (${sql.raw(checkIn(Hand))})`),
  ],
).enableRLS();

// ---------------------------------------------------------------- gear

export const balls = pgTable(
  'balls',
  {
    id: id(),
    userId: ownedBy(),
    name: text('name').notNull(),
    brand: text('brand'),
    weightLb: smallint('weight_lb').notNull(),
    layout: text('layout'),
    surfaceGrit: smallint('surface_grit'),
    /** Cache maintained by derivation; rebuildable from games and maintenance events. */
    gamesSinceResurface: smallint('games_since_resurface').notNull().default(0),
    retiredAt: timestamptz('retired_at'),
    createdAt: createdAt(),
  },
  (t) => [
    unique('balls_user_name_key').on(t.userId, t.name),
    check('balls_weight_range', sql`${t.weightLb} BETWEEN 6 AND 16`),
    check('balls_grit_positive', sql`${t.surfaceGrit} > 0`),
    check('balls_games_since_resurface_nonnegative', sql`${t.gamesSinceResurface} >= 0`),
  ],
).enableRLS();

export const ballMaintenanceEvents = pgTable(
  'ball_maintenance_events',
  {
    id: id(),
    ballId: uuid('ball_id')
      .notNull()
      .references(() => balls.id, { onDelete: 'cascade' }),
    kind: smallint('kind').notNull(),
    performedAt: timestamptz('performed_at').notNull(),
    notes: text('notes'),
    createdAt: createdAt(),
  },
  (t) => [
    index('ball_maintenance_events_ball_idx').on(t.ballId, t.performedAt.desc()),
    check('ball_maintenance_events_kind_valid', sql`${t.kind} IN (${sql.raw(checkIn(MaintenanceKind))})`),
  ],
).enableRLS();

// ---------------------------------------------------------------- the throw spine: append-only, client-authored

export const sessions = pgTable(
  'sessions',
  {
    id: id(),
    userId: ownedBy(),
    /** Generated on the phone. `(user_id, client_id)` makes a retried sync upload a no-op. */
    clientId: uuid('client_id').notNull(),
    houseId: uuid('house_id').references(() => houses.id, { onDelete: 'set null' }),
    oilPatternId: uuid('oil_pattern_id').references(() => oilPatterns.id, { onDelete: 'set null' }),
    startedAt: timestamptz('started_at').notNull(),
    /** The phone uploads only finished sessions. */
    endedAt: timestamptz('ended_at').notNull(),
    syncedAt: timestamptz('synced_at').notNull().defaultNow(),
    /** Voided sessions stay for the record but are excluded from every stat. */
    voidedAt: timestamptz('voided_at'),
    voidReason: text('void_reason'),
  },
  (t) => [
    unique('sessions_user_client_key').on(t.userId, t.clientId),
    unique('sessions_id_user_key').on(t.id, t.userId),
    index('sessions_user_started_idx').on(t.userId, t.startedAt.desc()),
    check('sessions_ended_after_started', sql`${t.endedAt} >= ${t.startedAt}`),
    check('sessions_void_reason_iff_voided', sql`(${t.voidedAt} IS NULL) = (${t.voidReason} IS NULL)`),
  ],
).enableRLS();

export const games = pgTable(
  'games',
  {
    id: id(),
    sessionId: uuid('session_id').notNull(),
    userId: uuid('user_id').notNull(),
    gameNumber: smallint('game_number').notNull(),
    /** Score of the last frame whose score is known; the final score when complete. */
    totalScore: smallint('total_score').notNull(),
    /** False means abandoned. Abandoned games are excluded from every attribute calculation. */
    isComplete: boolean('is_complete').notNull(),
    ballId: uuid('ball_id').references(() => balls.id, { onDelete: 'set null' }),
  },
  (t) => [
    foreignKey({ name: 'games_session_fk', columns: [t.sessionId, t.userId], foreignColumns: [sessions.id, sessions.userId] }).onDelete(
      'cascade',
    ),
    unique('games_session_game_number_key').on(t.sessionId, t.gameNumber),
    unique('games_id_user_key').on(t.id, t.userId),
    index('games_ball_idx')
      .on(t.ballId)
      .where(sql`${t.ballId} IS NOT NULL`),
    check('games_game_number_positive', sql`${t.gameNumber} >= 1`),
    check('games_total_score_range', sql`${t.totalScore} BETWEEN 0 AND 300`),
  ],
).enableRLS();

export const frames = pgTable(
  'frames',
  {
    id: id(),
    gameId: uuid('game_id').notNull(),
    userId: uuid('user_id').notNull(),
    frameNumber: smallint('frame_number').notNull(),
    /**
     * Leave after the frame's first ball. Null when that ball was a foul, since
     * the pins were respotted and nothing was left. Tenth-frame reset-rack leaves
     * live on `throws`, which is what the bestiary reads.
     */
    leaveMask: smallint('leave_mask'),
    isStrike: boolean('is_strike').notNull(),
    /** Spare on the first two balls. A tenth-frame X then 9/ is a strike frame. */
    isSpare: boolean('is_spare').notNull(),
    isSplit: boolean('is_split').notNull(),
    /** Null until the frame and its bonus balls are known (always, in an abandoned game's tail). */
    frameScore: smallint('frame_score'),
    cumulativeScore: smallint('cumulative_score'),
  },
  (t) => [
    foreignKey({ name: 'frames_game_fk', columns: [t.gameId, t.userId], foreignColumns: [games.id, games.userId] }).onDelete('cascade'),
    unique('frames_game_frame_number_key').on(t.gameId, t.frameNumber),
    unique('frames_id_user_key').on(t.id, t.userId),
    check('frames_frame_number_range', sql`${t.frameNumber} BETWEEN 1 AND 10`),
    check('frames_leave_mask_range', pinMaskInRange(t.leaveMask)),
    check('frames_strike_xor_spare', sql`NOT (${t.isStrike} AND ${t.isSpare})`),
    check('frames_strike_leaves_nothing', sql`NOT ${t.isStrike} OR ${t.leaveMask} = 0`),
    check('frames_frame_score_range', sql`${t.frameScore} BETWEEN 0 AND 30`),
    check('frames_cumulative_score_range', sql`${t.cumulativeScore} BETWEEN 0 AND 300`),
  ],
).enableRLS();

export const throws = pgTable(
  'throws',
  {
    id: id(),
    frameId: uuid('frame_id').notNull(),
    userId: uuid('user_id').notNull(),
    throwNumber: smallint('throw_number').notNull(),
    pinsStandingBefore: smallint('pins_standing_before').notNull(),
    pinsKnocked: smallint('pins_knocked').notNull(),
    /** A foul scores zero and the pins that fell are respotted. */
    isFoul: boolean('is_foul').notNull().default(false),
    /**
     * Thrown at a freshly set rack: a frame's first ball, or a reset rack in the
     * tenth. A full rack after a foul respot is not new. Fixed by the scoring rules.
     */
    newRack: boolean('new_rack').notNull(),
    /** Pins physically left standing, before any respot. Computed, so it can't disagree. */
    leaveMask: smallint('leave_mask').generatedAlwaysAs(sql`pins_standing_before & ~pins_knocked`),
    /** Split leave after a legal ball at a new rack, per ADR 0001. */
    isSplit: boolean('is_split').notNull().default(false),
    ballId: uuid('ball_id').references(() => balls.id, { onDelete: 'set null' }),
    boardTarget: smallint('board_target'),
    speedMph: numeric('speed_mph', { precision: 4, scale: 1 }),
    thrownAt: timestamptz('thrown_at').notNull(),
  },
  (t) => [
    foreignKey({ name: 'throws_frame_fk', columns: [t.frameId, t.userId], foreignColumns: [frames.id, frames.userId] }).onDelete(
      'cascade',
    ),
    // Also serves the cascade from frames, so no separate (frame_id) index.
    unique('throws_frame_throw_number_key').on(t.frameId, t.throwNumber),
    // The bestiary: every leave this user faced for a spare, including tenth-frame reset racks.
    index('throws_bestiary_idx')
      .on(t.userId, t.leaveMask)
      .where(sql`new_rack AND NOT is_foul AND leave_mask <> 0`),
    // Per-ball carry stats.
    index('throws_ball_idx')
      .on(t.ballId, t.thrownAt.desc())
      .where(sql`${t.ballId} IS NOT NULL`),
    check('throws_throw_number_range', sql`${t.throwNumber} BETWEEN 1 AND 3`),
    check('throws_standing_range', sql`${t.pinsStandingBefore} BETWEEN 1 AND 1023`),
    check('throws_knocked_range', pinMaskInRange(t.pinsKnocked)),
    check('throws_knocked_were_standing', sql`(${t.pinsStandingBefore} & ${t.pinsKnocked}) = ${t.pinsKnocked}`),
    check('throws_new_rack_is_full', sql`NOT ${t.newRack} OR ${t.pinsStandingBefore} = 1023`),
    check('throws_split_needs_legal_new_rack', sql`NOT ${t.isSplit} OR (${t.newRack} AND NOT ${t.isFoul})`),
    check('throws_board_target_range', sql`${t.boardTarget} BETWEEN 1 AND 39`),
    check('throws_speed_range', sql`${t.speedMph} > 0 AND ${t.speedMph} <= 40`),
  ],
).enableRLS();

// ---------------------------------------------------------------- progression: server-owned, rebuildable from the throw log

/** One row per user. A cache of the XP ledger, safe to rebuild. */
export const playerState = pgTable(
  'player_state',
  {
    userId: uuid('user_id')
      .primaryKey()
      .references(() => authUsers.id, { onDelete: 'cascade' }),
    level: smallint('level').notNull().default(1),
    totalXp: integer('total_xp').notNull().default(0),
    xpIntoLevel: integer('xp_into_level').notNull().default(0),
    rankTier: smallint('rank_tier').notNull().default(0),
    formulaVersion: smallint('formula_version').notNull(),
    updatedAt: timestamptz('updated_at').notNull().defaultNow(),
  },
  (t) => [
    check('player_state_level_positive', sql`${t.level} >= 1`),
    check('player_state_xp_nonnegative', sql`${t.totalXp} >= 0`),
    check('player_state_xp_into_level_range', sql`${t.xpIntoLevel} BETWEEN 0 AND ${t.totalXp}`),
  ],
).enableRLS();

/** Append-only XP ledger. The unique key makes the derivation job safe to retry. */
export const xpEvents = pgTable(
  'xp_events',
  {
    id: id(),
    userId: ownedBy(),
    sourceType: smallint('source_type').notNull(),
    sourceId: uuid('source_id').notNull(),
    amount: integer('amount').notNull(),
    formulaVersion: smallint('formula_version').notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    unique('xp_events_source_key').on(t.userId, t.sourceType, t.sourceId),
    index('xp_events_user_created_idx').on(t.userId, t.createdAt.desc()),
    check('xp_events_source_type_valid', sql`${t.sourceType} IN (${sql.raw(checkIn(XpSource))})`),
  ],
).enableRLS();

/** The bestiary, materialised: one row per leave this user has actually faced. */
export const leaveEncounters = pgTable(
  'leave_encounters',
  {
    userId: ownedBy(),
    leaveMask: smallint('leave_mask').notNull(),
    attempts: integer('attempts').notNull().default(0),
    conversions: integer('conversions').notNull().default(0),
    firstSeenAt: timestamptz('first_seen_at').notNull(),
    lastConvertedAt: timestamptz('last_converted_at'),
  },
  (t) => [
    primaryKey({ name: 'leave_encounters_pkey', columns: [t.userId, t.leaveMask] }),
    check('leave_encounters_leave_mask_range', sql`${t.leaveMask} BETWEEN 1 AND 1023`),
    check('leave_encounters_conversions_range', sql`${t.conversions} BETWEEN 0 AND ${t.attempts}`),
  ],
).enableRLS();

// ---------------------------------------------------------------- operational

/**
 * Append-only: a trigger (migration 0001) rejects UPDATE and DELETE for every
 * role. No foreign key on `actor_id`, so entries outlive a deleted account.
 */
export const auditLog = pgTable('audit_log', {
  id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
  actorId: uuid('actor_id'),
  action: text('action').notNull(),
  entity: text('entity').notNull(),
  entityId: uuid('entity_id'),
  ip: inet('ip'),
  metadata: jsonb('metadata').notNull().default({}),
  createdAt: createdAt(),
}).enableRLS();
