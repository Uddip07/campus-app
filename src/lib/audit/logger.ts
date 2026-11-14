import { connectToDatabase } from "@/db/mongodb";
import { AuditLog } from "@/db/models/AuditLog";
import mongoose from "mongoose";

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
 * Persists an immutable audit log record to MongoDB Atlas.
 * Guarantees zero fabrication of audit events.
 */
export async function logAuditEvent(input: LogAuditInput): Promise<void> {
  try {
    await connectToDatabase();

    const actorObjectId = mongoose.Types.ObjectId.isValid(input.actorId)
      ? new mongoose.Types.ObjectId(input.actorId)
      : input.actorId;

    await AuditLog.create({
      actorId: actorObjectId,
      action: input.action,
      targetType: input.targetType,
      targetId: input.targetId || null,
      metadata: input.metadata || {},
    });
  } catch (err) {
    console.error("[AuditLog] Failed to persist audit record to MongoDB:", err);
    throw new Error("Failed to create audit log record.");
  }
}
