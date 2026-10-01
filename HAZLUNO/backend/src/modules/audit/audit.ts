import type { Deps } from '../../common/env.js';
import { newId } from '../../common/security.js';

export interface AuditEntry {
  actorId: string | null;
  action: string;
  targetType?: string;
  targetId?: string;
  ipHash?: string | null;
  userAgent?: string | null;
  data?: Record<string, unknown>;
}

export const auditStatement = (deps: Deps, e: AuditEntry) => ({
  sql: `INSERT INTO audit_logs (id, actor_id, action, target_type, target_id, ip_hash, user_agent, data, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  params: [newId(), e.actorId, e.action, e.targetType ?? null, e.targetId ?? null, e.ipHash ?? null, e.userAgent ?? null,
    JSON.stringify(e.data ?? {}), deps.clock.now().toISOString()],
});

export async function audit(deps: Deps, e: AuditEntry) {
  const s = auditStatement(deps, e);
  await deps.db.run(s.sql, s.params);
}
