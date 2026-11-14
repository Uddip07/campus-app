import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { canModerate } from "@/lib/auth/rbac";
import { connectToDatabase } from "@/db/mongodb";
import { Message } from "@/db/models/Message";
import { logAuditEvent } from "@/lib/audit/logger";
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

    const { id } = params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json({ error: "Message not found" }, { status: 404 });
    }

    await connectToDatabase();

    const message = await Message.findById(id);

    if (!message) {
      return NextResponse.json({ error: "Message not found" }, { status: 404 });
    }

    const isAuthor = message.senderId.toString() === user.userId;
    const hasModPower = canModerate(user.role);

    if (!isAuthor && !hasModPower) {
      return NextResponse.json(
        { error: "You are not authorized to delete this message" },
        { status: 403 }
      );
    }

    // Soft delete in MongoDB
    message.deletedAt = new Date();
    await message.save();

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
