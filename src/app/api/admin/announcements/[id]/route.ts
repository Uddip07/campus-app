import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { canManageAnnouncements } from "@/lib/auth/rbac";
import { logAuditEvent } from "@/lib/audit/logger";
import { db, schema } from "@/db";
import { eq } from "drizzle-orm";

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

    if (!canManageAnnouncements(user.role)) {
      return NextResponse.json(
        { error: "You are not authorized to delete announcements." },
        { status: 403 }
      );
    }

    const { id } = params;
    const existing = await db.query.announcements.findFirst({
      where: eq(schema.announcements.id, id),
    });

    if (!existing) {
      return NextResponse.json({ error: "Announcement not found" }, { status: 404 });
    }

    await db.delete(schema.announcements).where(eq(schema.announcements.id, id));

    await logAuditEvent({
      actorId: user.userId,
      action: "ANNOUNCEMENT_DELETED",
      targetType: "announcement",
      targetId: id,
      metadata: { title: existing.title },
    });

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Error deleting announcement";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
