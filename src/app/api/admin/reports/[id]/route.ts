import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUser } from "@/lib/auth/session";
import { canModerate } from "@/lib/auth/rbac";
import { logAuditEvent } from "@/lib/audit/logger";
import { db, schema } from "@/db";
import { eq } from "drizzle-orm";

const reportActionSchema = z.object({
  action: z.enum([
    "dismiss",
    "warn",
    "mute",
    "temp_ban",
    "permanent_ban",
    "remove_message",
  ]),
  durationHours: z.number().positive().optional().default(24),
  reason: z.string().optional(),
});

interface RouteParams {
  params: {
    id: string;
  };
}

export async function PATCH(req: NextRequest, { params }: RouteParams) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!canModerate(user.role)) {
      return NextResponse.json(
        { error: "You are not authorized to moderate reports." },
        { status: 403 }
      );
    }

    const { id: reportId } = params;
    const body = await req.json().catch(() => ({}));
    const parseResult = reportActionSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        { error: "Invalid action payload", details: parseResult.error.format() },
        { status: 400 }
      );
    }

    const { action, durationHours, reason } = parseResult.data;

    const report = await db.query.reports.findFirst({
      where: eq(schema.reports.id, reportId),
      with: {
        message: true,
      },
    });

    if (!report) {
      return NextResponse.json({ error: "Report not found" }, { status: 404 });
    }

    const now = new Date();
    const actionReason = reason || `Moderator action via report ${reportId}: ${action}`;

    if (action === "dismiss") {
      await db
        .update(schema.reports)
        .set({
          status: "dismissed",
          reviewedBy: user.userId,
          resolvedAt: now,
        })
        .where(eq(schema.reports.id, reportId));

      await logAuditEvent({
        actorId: user.userId,
        action: "REPORT_DISMISSED",
        targetType: "report",
        targetId: reportId,
        metadata: { reason: actionReason },
      });

      return NextResponse.json({ success: true, action: "dismissed" });
    }

    // Message removal action
    if (action === "remove_message" && report.messageId) {
      await db
        .update(schema.messages)
        .set({
          moderationStatus: "removed",
          deletedAt: now,
        })
        .where(eq(schema.messages.id, report.messageId));

      await db
        .update(schema.reports)
        .set({
          status: "resolved",
          reviewedBy: user.userId,
          resolvedAt: now,
        })
        .where(eq(schema.reports.id, reportId));

      await logAuditEvent({
        actorId: user.userId,
        action: "MESSAGE_REMOVED",
        targetType: "message",
        targetId: report.messageId,
        metadata: { reportId, reason: actionReason },
      });

      return NextResponse.json({ success: true, action: "message_removed" });
    }

    // Punitive actions on message sender
    const offenderId = report.message?.senderId;
    if (!offenderId) {
      return NextResponse.json(
        { error: "Cannot apply action: message author record unavailable." },
        { status: 400 }
      );
    }

    if (action === "mute") {
      const expiresAt = new Date(now.getTime() + durationHours * 3600 * 1000);
      await db.insert(schema.bans).values({
        userId: offenderId,
        type: "mute",
        reason: actionReason,
        expiresAt,
        createdBy: user.userId,
      });

      await db
        .update(schema.reports)
        .set({
          status: "resolved",
          reviewedBy: user.userId,
          resolvedAt: now,
        })
        .where(eq(schema.reports.id, reportId));

      await logAuditEvent({
        actorId: user.userId,
        action: "USER_MUTED",
        targetType: "user",
        targetId: offenderId,
        metadata: { expiresAt: expiresAt.toISOString(), reason: actionReason },
      });

      return NextResponse.json({ success: true, action: "muted" });
    }

    if (action === "temp_ban") {
      const expiresAt = new Date(now.getTime() + durationHours * 3600 * 1000);
      await db.insert(schema.bans).values({
        userId: offenderId,
        type: "temp_ban",
        reason: actionReason,
        expiresAt,
        createdBy: user.userId,
      });

      await db
        .update(schema.users)
        .set({ status: "suspended", updatedAt: now })
        .where(eq(schema.users.id, offenderId));

      await db
        .update(schema.reports)
        .set({
          status: "resolved",
          reviewedBy: user.userId,
          resolvedAt: now,
        })
        .where(eq(schema.reports.id, reportId));

      await logAuditEvent({
        actorId: user.userId,
        action: "USER_BANNED",
        targetType: "user",
        targetId: offenderId,
        metadata: { type: "temp_ban", expiresAt: expiresAt.toISOString(), reason: actionReason },
      });

      return NextResponse.json({ success: true, action: "temp_banned" });
    }

    if (action === "permanent_ban") {
      await db.insert(schema.bans).values({
        userId: offenderId,
        type: "permanent_ban",
        reason: actionReason,
        expiresAt: null,
        createdBy: user.userId,
      });

      await db
        .update(schema.users)
        .set({ status: "banned", updatedAt: now })
        .where(eq(schema.users.id, offenderId));

      await db
        .update(schema.reports)
        .set({
          status: "resolved",
          reviewedBy: user.userId,
          resolvedAt: now,
        })
        .where(eq(schema.reports.id, reportId));

      await logAuditEvent({
        actorId: user.userId,
        action: "USER_BANNED",
        targetType: "user",
        targetId: offenderId,
        metadata: { type: "permanent_ban", reason: actionReason },
      });

      return NextResponse.json({ success: true, action: "permanently_banned" });
    }

    if (action === "warn") {
      await db
        .update(schema.reports)
        .set({
          status: "resolved",
          reviewedBy: user.userId,
          resolvedAt: now,
        })
        .where(eq(schema.reports.id, reportId));

      await logAuditEvent({
        actorId: user.userId,
        action: "REPORT_RESOLVED",
        targetType: "report",
        targetId: reportId,
        metadata: { outcome: "warn", reason: actionReason },
      });

      return NextResponse.json({ success: true, action: "warned" });
    }

    return NextResponse.json({ error: "Unhandled action" }, { status: 400 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Error moderating report";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
