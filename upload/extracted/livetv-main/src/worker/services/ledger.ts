import { DomainError } from "../lib/errors";

export type LedgerType =
  | "CREDIT_PURCHASE" | "LINE_CREATION" | "RENEWAL" | "ADMIN_ADJUSTMENT" | "REFUND" | "PROMOTIONAL_CREDIT" | "TRANSFER";

export interface LedgerEntry {
  id: string;
  resellerId: string;
  type: LedgerType;
  amountCenti: number; // signed: + credit, - debit
  reference?: string | null;
  orderId?: string | null;
  adminId?: string | null;
  idempotencyKey?: string | null;
}

/** Optional precondition: only touch the balance if this order exists (and, optionally, has this status). */
export interface LedgerGuard {
  orderId: string;
  orderStatus?: string;
}

export interface LedgerTx {
  id: string;
  reseller_id: string;
  type: string;
  amount_centi: number;
  previous_balance_centi: number;
  new_balance_centi: number;
  order_id: string | null;
  idempotency_key: string | null;
}

const NOW = `strftime('%Y-%m-%dT%H:%M:%fZ','now')`;

/**
 * The three statements that move credits. They MUST run inside one db.batch() (a D1 batch is a transaction):
 *  1. make sure the balance row exists
 *  2. apply the delta. reseller_balances has CHECK (balance_centi >= 0), so an overspend aborts the whole batch
 *  3. append the ledger row. previous/new balance are read from the row UPDATE just wrote, so the
 *     ledger's CHECK (new = previous + amount) holds by construction; UNIQUE(idempotency_key) aborts
 *     (and rolls back step 2) on a duplicate.
 */
export function ledgerStatements(db: any, e: LedgerEntry, guard?: LedgerGuard): any[] {
  if (!Number.isSafeInteger(e.amountCenti) || e.amountCenti === 0) {
    throw new DomainError("INVALID_AMOUNT", "amount must be a non-zero integer number of centi-credits", 400);
  }
  const guardSql = (n: number) =>
    guard ? ` AND EXISTS (SELECT 1 FROM orders WHERE id = ?${n}${guard.orderStatus ? ` AND status = ?${n + 1}` : ""})` : "";
  const guardArgs = guard ? (guard.orderStatus ? [guard.orderId, guard.orderStatus] : [guard.orderId]) : [];

  return [
    db.prepare(`INSERT OR IGNORE INTO reseller_balances (reseller_id, balance_centi) VALUES (?1, 0)`).bind(e.resellerId),
    db
      .prepare(`UPDATE reseller_balances SET balance_centi = balance_centi + ?1, updated_at = ${NOW} WHERE reseller_id = ?2${guardSql(3)}`)
      .bind(e.amountCenti, e.resellerId, ...guardArgs),
    db
      .prepare(
        `INSERT INTO credit_transactions
           (id, reseller_id, type, amount_centi, previous_balance_centi, new_balance_centi, reference, order_id, admin_id, idempotency_key)
         SELECT ?1, ?2, ?3, ?4, b.balance_centi - ?4, b.balance_centi, ?5, ?6, ?7, ?8
         FROM reseller_balances b WHERE b.reseller_id = ?2${guardSql(9)}`,
      )
      .bind(
        e.id, e.resellerId, e.type, e.amountCenti, e.reference ?? null, e.orderId ?? null, e.adminId ?? null,
        e.idempotencyKey ?? null, ...guardArgs,
      ),
  ];
}

export function classifyDbError(err: unknown): "IDEMPOTENCY" | "FUNDS" | "FK" | "OTHER" {
  const m = err instanceof Error ? err.message : String(err);
  if (/UNIQUE constraint failed: (credit_transactions|orders)\.idempotency_key/.test(m)) return "IDEMPOTENCY";
  if (/CHECK constraint failed/.test(m)) return "FUNDS";
  if (/FOREIGN KEY constraint failed/.test(m)) return "FK";
  return "OTHER";
}

/**
 * Standalone credit movement (purchase, admin adjustment, promo). `extra` statements (e.g. an audit row)
 * join the same atomic batch. Replaying an idempotency key returns the original transaction and changes nothing.
 */
export async function applyLedger(
  db: any,
  e: LedgerEntry,
  extra: any[] = [],
): Promise<{ tx: LedgerTx; replayed: boolean }> {
  const find = (key: string) =>
    db.prepare(`SELECT * FROM credit_transactions WHERE idempotency_key = ?1`).bind(key).first();

  if (e.idempotencyKey) {
    const existing = await find(e.idempotencyKey);
    if (existing) return { tx: sameRequestOrThrow(existing, e), replayed: true };
  }
  try {
    await db.batch([...ledgerStatements(db, e), ...extra]);
  } catch (err) {
    const kind = classifyDbError(err);
    if (kind === "IDEMPOTENCY" && e.idempotencyKey) {
      const existing = await find(e.idempotencyKey);
      if (existing) return { tx: sameRequestOrThrow(existing, e), replayed: true };
    }
    if (kind === "FUNDS" && e.amountCenti < 0) throw new DomainError("INSUFFICIENT_CREDITS", "Insufficient credits", 402);
    if (kind === "FK") throw new DomainError("NOT_FOUND", "Reseller not found", 404);
    throw err;
  }
  const tx = await db.prepare(`SELECT * FROM credit_transactions WHERE id = ?1`).bind(e.id).first();
  if (!tx) throw new Error("ledger row missing after successful batch");
  return { tx, replayed: false };
}

function sameRequestOrThrow(existing: LedgerTx, e: LedgerEntry): LedgerTx {
  if (existing.reseller_id !== e.resellerId || existing.amount_centi !== e.amountCenti || existing.type !== e.type) {
    throw new DomainError("IDEMPOTENCY_KEY_REUSED", "Idempotency key was already used for a different request", 409);
  }
  return existing;
}

export async function getBalance(db: any, resellerId: string): Promise<number> {
  const row = await db.prepare(`SELECT balance_centi FROM reseller_balances WHERE reseller_id = ?1`).bind(resellerId).first();
  return row?.balance_centi ?? 0;
}

/** Rows where the stored balance differs from the sum of the ledger. Empty = healthy. For the stage-3 reconciliation job. */
export async function ledgerDrift(db: any): Promise<Array<{ reseller_id: string; balance_centi: number; ledger_sum: number }>> {
  const r = await db
    .prepare(
      `SELECT b.reseller_id, b.balance_centi, COALESCE(SUM(t.amount_centi), 0) AS ledger_sum
       FROM reseller_balances b LEFT JOIN credit_transactions t ON t.reseller_id = b.reseller_id
       GROUP BY b.reseller_id HAVING b.balance_centi <> COALESCE(SUM(t.amount_centi), 0)`,
    )
    .all();
  return r.results;
}
