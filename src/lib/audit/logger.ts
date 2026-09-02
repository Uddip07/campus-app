import { db, schema } from "@/db";

export interface LogAuditInput {
  actorId: string;
  action:
    | "IDENTITY_RESOLUTION"
    | "USER_BANNED"
    | "USER_MUTED"
    | "USER_UNBANNED"
    | "REPORT_DISMISSED"
    | "REPORT_RESOLVED"
    | "MESSAGE_REMOVED"
    | "ANNOUNCEMENT_CREATED"
    | "ANNOUNCEMENT_EDITED"
    | "ANNOUNCEMENT_DELETED"
    | "ROLE_CHANGED";
  targetType: string;
  targetId?: string | null;
  metadata?: Record<string, unknown>;
}

/**
 * Persists an immutable audit log record to PostgreSQL.
 * Never fabricates audit events.
 */
export async function logAuditEvent(input: LogAuditInput): Promise<void> {
  try {
    await db.insert(schema.auditLogs).values({
      actorId: input.actorId,
      action: input.action,
      targetType: input.targetType,
      targetId: input.targetId || null,
      metadata: input.metadata || {},
    });
  } catch (err) {
    console.error("[AuditLog] Failed to persist audit record:", err);
    // Audit log failure in privileged operations must be handled conscientiously
    throw new Error("Failed to create audit log record.");
  }
}
