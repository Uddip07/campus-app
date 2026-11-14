import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUser } from "@/lib/auth/session";
import { canModerate } from "@/lib/auth/rbac";
import { logAuditEvent } from "@/lib/audit/logger";
import { connectToDatabase } from "@/db/mongodb";
import { Ban } from "@/db/models/Ban";
import mongoose from "mongoose";

const muteSchema = z.object({
  reason: z.string().trim().min(3),
  durationHours: z.number().positive().optional().default(24),
});

interface RouteParams {
  params: {
    id: string;
  };
}

export async function POST(req: NextRequest, { params }: RouteParams) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!canModerate(user.role)) {
      return NextResponse.json(
        { error: "Forbidden: You are not authorized to mute users." },
        { status: 403 }
      );
    }

    const { id: targetUserId } = params;
    if (!mongoose.Types.ObjectId.isValid(targetUserId)) {
      return NextResponse.json({ error: "Invalid target user ID" }, { status: 400 });
    }

    const body = await req.json().catch(() => ({}));
    const parseResult = muteSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        { error: "Invalid mute payload", details: parseResult.error.format() },
        { status: 400 }
      );
    }

    const { reason, durationHours } = parseResult.data;
    const now = new Date();
    const expiresAt = new Date(now.getTime() + durationHours * 3600 * 1000);

    await connectToDatabase();

    await Ban.create({
      userId: new mongoose.Types.ObjectId(targetUserId),
      type: "mute",
      reason,
      expiresAt,
      createdBy: new mongoose.Types.ObjectId(user.userId),
    });

    await logAuditEvent({
      actorId: user.userId,
      action: "USER_MUTED",
      targetType: "user",
      targetId: targetUserId,
      metadata: { reason, expiresAt: expiresAt.toISOString() },
    });

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Error muting user";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
