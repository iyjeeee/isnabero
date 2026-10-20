import { AUDIT_ACTIONS, type AuditAction } from "../audit";

// Mock-mode audit logging. In Supabase mode the same rows are written by database triggers, so repositories must NOT
// call this from their Supabase implementations.
export interface AuditActor {
  id: string;
  name: string;
}

let currentActor: AuditActor | null = null;

// setAuditActor: AuthProvider sets this to the signed-in employee (null on sign-out) so mock mutations know who acted
export function setAuditActor(actor: AuditActor | null): void {
  currentActor = actor;
}

// getAuditActor: who is acting right now in mock mode (null when nobody is signed in)
export function getAuditActor(): AuditActor | null {
  return currentActor;
}

export interface AuditEntry {
  businessId: string;
  action: AuditAction;
  entityId: string | null;
  summary: string;
}

export interface AuditRow {
  id: string;
  businessId: string;
  actorId: string | null;
  actorName: string;
  action: string;
  entityType: string;
  entityId: string | null;
  summary: string;
  createdAt: Date;
}

// auditRows: the mock audit_log table (kept here, not in store.ts, so it can't disturb the seeded data's rng order)
export const auditRows: AuditRow[] = [];

export function recordAudit(entry: AuditEntry): void {
  auditRows.push({
    id: crypto.randomUUID(),
    businessId: entry.businessId,
    actorId: currentActor?.id ?? null,
    actorName: currentActor?.name ?? "System",
    action: entry.action,
    entityType: AUDIT_ACTIONS[entry.action].entity,
    entityId: entry.entityId,
    summary: entry.summary,
    createdAt: new Date(),
  });
}
