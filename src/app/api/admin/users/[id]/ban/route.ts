import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUser } from "@/lib/auth/session";
import { canModerate } from "@/lib/auth/rbac";
import { logAuditEvent } from "@/lib/audit/logger";
import { db, schema } from "@/db";
import { eq } from "drizzle-orm";

const banSchema = z.object({
  type: z.enum(["temp_ban", "permanent_ban"]),
  reason: z.string().trim().min(3),
  durationDays: z.number().positive().optional().default(7),
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
        { error: "Forbidden: You are not authorized to ban users." },
        { status: 403 }
      );
    }

    const { id: targetUserId } = params;
    const body = await req.json().catch(() => ({}));
    const parseResult = banSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        { error: "Invalid ban payload", details: parseResult.error.format() },
        { status: 400 }
      );
    }

    const { type, reason, durationDays } = parseResult.data;
    const now = new Date();
    const expiresAt =
      type === "temp_ban"
        ? new Date(now.getTime() + durationDays * 24 * 3600 * 1000)
        : null;

    await db.insert(schema.bans).values({
      userId: targetUserId,
      type,
      reason,
      expiresAt,
      createdBy: user.userId,
    });

    await db
      .update(schema.users)
      .set({
        status: type === "permanent_ban" ? "banned" : "suspended",
        updatedAt: now,
      })
      .where(eq(schema.users.id, targetUserId));

    await logAuditEvent({
      actorId: user.userId,
      action: "USER_BANNED",
      targetType: "user",
      targetId: targetUserId,
      metadata: { type, reason, expiresAt: expiresAt?.toISOString() },
    });

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Error banning user";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
