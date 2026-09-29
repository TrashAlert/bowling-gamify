/**
 * Small-integer codes stored in `smallint` columns. Postgres enums are harder
 * to change safely; these are append-only, and every column has a CHECK that
 * lists the valid values, so update both together.
 */

export const Hand = { right: 1, left: 2 } as const;
export type Hand = (typeof Hand)[keyof typeof Hand];

export const MaintenanceKind = { resurface: 1, plug: 2, redrill: 3, oilExtraction: 4 } as const;
export type MaintenanceKind = (typeof MaintenanceKind)[keyof typeof MaintenanceKind];

export const OilPatternCategory = { house: 1, sport: 2, challenge: 3 } as const;
export type OilPatternCategory = (typeof OilPatternCategory)[keyof typeof OilPatternCategory];

/** What earned an XP event. `(user_id, source_type, source_id)` is unique, so one award per source. */
export const XpSource = { session: 1, quest: 2, achievement: 3, adjustment: 4 } as const;
export type XpSource = (typeof XpSource)[keyof typeof XpSource];

/** `IN (...)` list for a CHECK constraint. Values are our own constants, never user input. */
export const checkIn = (codes: Readonly<Record<string, number>>) => Object.values(codes).join(', ');
