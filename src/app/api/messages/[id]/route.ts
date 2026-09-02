import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { canModerate } from "@/lib/auth/rbac";
import { db, schema } from "@/db";
import { eq } from "drizzle-orm";
import { logAuditEvent } from "@/lib/audit/logger";

interface RouteParams {
  params: {
    id: string;
  };
}

export async function DELETE(req: NextRequest, { params }: RouteParams) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = params;
    const message = await db.query.messages.findFirst({
      where: eq(schema.messages.id, id),
    });

    if (!message) {
      return NextResponse.json({ error: "Message not found" }, { status: 404 });
    }

    const isAuthor = message.senderId === user.userId;
    const hasModPower = canModerate(user.role);

    if (!isAuthor && !hasModPower) {
      return NextResponse.json(
        { error: "You are not authorized to delete this message" },
        { status: 403 }
      );
    }

    // Soft delete
    await db
      .update(schema.messages)
      .set({
        deletedAt: new Date(),
      })
      .where(eq(schema.messages.id, id));

    if (!isAuthor && hasModPower) {
      await logAuditEvent({
        actorId: user.userId,
        action: "MESSAGE_REMOVED",
        targetType: "message",
        targetId: id,
        metadata: { reason: "Moderator removed message" },
      });
    }

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Error deleting message";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
