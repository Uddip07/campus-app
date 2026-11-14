import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { canManageAnnouncements } from "@/lib/auth/rbac";
import { logAuditEvent } from "@/lib/audit/logger";
import { connectToDatabase } from "@/db/mongodb";
import { Announcement } from "@/db/models/Announcement";
import mongoose from "mongoose";

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
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json({ error: "Announcement not found" }, { status: 404 });
    }

    await connectToDatabase();

    const existing = await Announcement.findById(id);

    if (!existing) {
      return NextResponse.json({ error: "Announcement not found" }, { status: 404 });
    }

    await Announcement.deleteOne({ _id: id });

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
