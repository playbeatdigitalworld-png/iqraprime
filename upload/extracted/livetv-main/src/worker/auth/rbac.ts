import { DomainError } from "../lib/errors";

export type Role = "SUPER_ADMIN" | "ADMIN" | "MASTER_RESELLER" | "RESELLER" | "SUB_RESELLER" | "SUPPORT" | "ACCOUNTANT";

export type Permission =
  | "line:create" | "line:renew"
  | "credits:read:own" | "credits:read:all" | "credits:adjust"
  | "orders:reconcile" | "provider:read" | "audit:read" | "users:manage";

const RESELLER_PERMS: Permission[] = ["line:create", "line:renew", "credits:read:own"];

export const MATRIX: Record<Role, ReadonlySet<Permission>> = {
  SUPER_ADMIN: new Set<Permission>(["line:create", "line:renew", "credits:read:own", "credits:read:all", "credits:adjust", "orders:reconcile", "provider:read", "audit:read", "users:manage"]),
  ADMIN: new Set<Permission>(["line:create", "line:renew", "credits:read:own", "credits:read:all", "credits:adjust", "orders:reconcile", "provider:read", "audit:read"]),
  MASTER_RESELLER: new Set(RESELLER_PERMS),
  RESELLER: new Set(RESELLER_PERMS),
  SUB_RESELLER: new Set(RESELLER_PERMS),
  SUPPORT: new Set<Permission>(["provider:read", "credits:read:own"]),
  ACCOUNTANT: new Set<Permission>(["credits:read:all", "audit:read"]),
};

export interface Actor {
  userId: string;
  role: Role;
  ip: string | null;
  requestId: string;
}

export const RESELLER_ROLES: ReadonlySet<Role> = new Set(["MASTER_RESELLER", "RESELLER", "SUB_RESELLER"]);

export function can(actor: Pick<Actor, "role">, perm: Permission): boolean {
  return MATRIX[actor.role]?.has(perm) ?? false;
}

export function requirePermission(actor: Pick<Actor, "role">, perm: Permission): void {
  if (!can(actor, perm)) throw new DomainError("FORBIDDEN", "You do not have permission to do that", 403);
}

/**
 * Stage 2 scope rule: resellers act only on their own data; admins/accountants read all (writes are gated by
 * permission, not scope). Downline visibility for MASTER_RESELLER (users.parent_id) lands with the stage-3 UI.
 */
export function canAccessReseller(actor: Pick<Actor, "role" | "userId">, resellerId: string): boolean {
  if (RESELLER_ROLES.has(actor.role)) return actor.userId === resellerId;
  return can(actor, "credits:read:all");
}
