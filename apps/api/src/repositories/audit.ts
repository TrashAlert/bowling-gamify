import type { UserId } from '@bowling-rpg/contracts';
import { type Database, auditLog } from '@bowling-rpg/db';

export interface AuditEntry {
  actorId: UserId | null;
  action: string;
  entity: string;
  entityId?: string;
  ip: string | null;
  metadata: Record<string, unknown>;
}

export async function insertAuditEntry(db: Database, entry: AuditEntry): Promise<void> {
  await db.insert(auditLog).values({
    actorId: entry.actorId,
    action: entry.action,
    entity: entry.entity,
    entityId: entry.entityId ?? null,
    ip: entry.ip,
    metadata: entry.metadata,
  });
}
