import { maskObject } from "../lib/mask";

export interface AuditCtx {
  actorId?: string | null;
  actorRole?: string | null;
  ip?: string | null;
  requestId?: string | null;
}

/** Prepared (not run) so callers can put it in the same db.batch() as the change it records. */
export function auditStatement(
  db: any,
  ctx: AuditCtx,
  action: string,
  target?: { type: string; id: string } | null,
  metadata?: Record<string, unknown>,
): any {
  return db
    .prepare(
      `INSERT INTO audit_logs (actor_id, actor_role, action, target_type, target_id, ip, request_id, metadata)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)`,
    )
    .bind(
      ctx.actorId ?? null, ctx.actorRole ?? null, action, target?.type ?? null, target?.id ?? null,
      ctx.ip ?? null, ctx.requestId ?? null, metadata ? JSON.stringify(maskObject(metadata)) : null,
    );
}

/** Best-effort write for events that are already recorded authoritatively elsewhere (ledger, orders). */
export async function audit(
  db: any,
  ctx: AuditCtx,
  action: string,
  target?: { type: string; id: string } | null,
  metadata?: Record<string, unknown>,
): Promise<void> {
  try {
    if (db?.prepare) {
      await auditStatement(db, ctx, action, target, metadata).run();
    }
  } catch (e) {
    console.error("audit write failed", action, e instanceof Error ? e.message : e);
  }
}
