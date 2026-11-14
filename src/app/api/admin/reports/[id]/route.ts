import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUser } from "@/lib/auth/session";
import { canModerate } from "@/lib/auth/rbac";
import { logAuditEvent } from "@/lib/audit/logger";
import { connectToDatabase } from "@/db/mongodb";
import { Report, Message, User, Ban } from "@/db/models";
import mongoose from "mongoose";

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
    if (!mongoose.Types.ObjectId.isValid(reportId)) {
      return NextResponse.json({ error: "Report not found" }, { status: 404 });
    }

    const body = await req.json().catch(() => ({}));
    const parseResult = reportActionSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        { error: "Invalid action payload", details: parseResult.error.format() },
        { status: 400 }
      );
    }

    const { action, durationHours, reason } = parseResult.data;

    await connectToDatabase();

    const report = await Report.findById(reportId).populate<{ messageId: any }>("messageId");

    if (!report) {
      return NextResponse.json({ error: "Report not found" }, { status: 404 });
    }

    const now = new Date();
    const actionReason = reason || `Moderator action via report ${reportId}: ${action}`;
    const reviewerObjectId = new mongoose.Types.ObjectId(user.userId);

    if (action === "dismiss") {
      report.status = "dismissed";
      report.reviewedBy = reviewerObjectId;
      report.resolvedAt = now;
      await report.save();

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
      const msgId = report.messageId._id || report.messageId;
      await Message.updateOne(
        { _id: msgId },
        { moderationStatus: "removed", deletedAt: now }
      );

      report.status = "resolved";
      report.reviewedBy = reviewerObjectId;
      report.resolvedAt = now;
      await report.save();

      await logAuditEvent({
        actorId: user.userId,
        action: "MESSAGE_REMOVED",
        targetType: "message",
        targetId: msgId.toString(),
        metadata: { reportId, reason: actionReason },
      });

      return NextResponse.json({ success: true, action: "message_removed" });
    }

    // Punitive actions on message sender
    const offenderId = report.messageId?.senderId;
    if (!offenderId) {
      return NextResponse.json(
        { error: "Cannot apply action: message author record unavailable." },
        { status: 400 }
      );
    }

    const offenderObjectId = new mongoose.Types.ObjectId(offenderId);

    if (action === "mute") {
      const expiresAt = new Date(now.getTime() + durationHours * 3600 * 1000);
      await Ban.create({
        userId: offenderObjectId,
        type: "mute",
        reason: actionReason,
        expiresAt,
        createdBy: reviewerObjectId,
      });

      report.status = "resolved";
      report.reviewedBy = reviewerObjectId;
      report.resolvedAt = now;
      await report.save();

      await logAuditEvent({
        actorId: user.userId,
        action: "USER_MUTED",
        targetType: "user",
        targetId: offenderId.toString(),
        metadata: { expiresAt: expiresAt.toISOString(), reason: actionReason },
      });

      return NextResponse.json({ success: true, action: "muted" });
    }

    if (action === "temp_ban") {
      const expiresAt = new Date(now.getTime() + durationHours * 3600 * 1000);
      await Ban.create({
        userId: offenderObjectId,
        type: "temp_ban",
        reason: actionReason,
        expiresAt,
        createdBy: reviewerObjectId,
      });

      await User.updateOne({ _id: offenderObjectId }, { status: "suspended" });

      report.status = "resolved";
      report.reviewedBy = reviewerObjectId;
      report.resolvedAt = now;
      await report.save();

      await logAuditEvent({
        actorId: user.userId,
        action: "USER_BANNED",
        targetType: "user",
        targetId: offenderId.toString(),
        metadata: { type: "temp_ban", expiresAt: expiresAt.toISOString(), reason: actionReason },
      });

      return NextResponse.json({ success: true, action: "temp_banned" });
    }

    if (action === "permanent_ban") {
      await Ban.create({
        userId: offenderObjectId,
        type: "permanent_ban",
        reason: actionReason,
        expiresAt: null,
        createdBy: reviewerObjectId,
      });

      await User.updateOne({ _id: offenderObjectId }, { status: "banned" });

      report.status = "resolved";
      report.reviewedBy = reviewerObjectId;
      report.resolvedAt = now;
      await report.save();

      await logAuditEvent({
        actorId: user.userId,
        action: "USER_BANNED",
        targetType: "user",
        targetId: offenderId.toString(),
        metadata: { type: "permanent_ban", reason: actionReason },
      });

      return NextResponse.json({ success: true, action: "permanently_banned" });
    }

    if (action === "warn") {
      report.status = "resolved";
      report.reviewedBy = reviewerObjectId;
      report.resolvedAt = now;
      await report.save();

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
