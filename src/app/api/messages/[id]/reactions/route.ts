import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUser } from "@/lib/auth/session";
import { connectToDatabase } from "@/db/mongodb";
import { Message, MessageReaction, ALLOWED_REACTIONS } from "@/db/models";
import mongoose from "mongoose";

const reactionSchema = z.object({
  reaction: z.enum(ALLOWED_REACTIONS),
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

    if (user.isMutedOrBanned) {
      return NextResponse.json({ error: "User is muted or banned" }, { status: 403 });
    }

    const { id: messageId } = params;
    if (!mongoose.Types.ObjectId.isValid(messageId)) {
      return NextResponse.json({ error: "Message not found" }, { status: 404 });
    }

    const body = await req.json().catch(() => ({}));
    const parseResult = reactionSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        { error: "Invalid reaction. Allowed: " + ALLOWED_REACTIONS.join(", ") },
        { status: 400 }
      );
    }

    const { reaction } = parseResult.data;

    await connectToDatabase();

    // Check message exists and is approved and active
    const message = await Message.findOne({
      _id: messageId,
      moderationStatus: "approved",
      deletedAt: null,
    });

    if (!message) {
      return NextResponse.json({ error: "Message not found" }, { status: 404 });
    }

    const messageObjectId = new mongoose.Types.ObjectId(messageId);
    const userObjectId = new mongoose.Types.ObjectId(user.userId);

    // Toggle reaction in MongoDB
    const existing = await MessageReaction.findOne({
      messageId: messageObjectId,
      userId: userObjectId,
      reaction,
    });

    if (existing) {
      await MessageReaction.deleteOne({ _id: existing._id });
      return NextResponse.json({ reacted: false, reaction });
    } else {
      await MessageReaction.create({
        messageId: messageObjectId,
        userId: userObjectId,
        reaction,
      });
      return NextResponse.json({ reacted: true, reaction });
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Reaction error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: RouteParams) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: messageId } = params;
    if (!mongoose.Types.ObjectId.isValid(messageId)) {
      return NextResponse.json({ error: "Invalid message ID" }, { status: 400 });
    }

    const body = await req.json().catch(() => ({}));
    const parseResult = reactionSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json({ error: "Invalid reaction" }, { status: 400 });
    }

    const { reaction } = parseResult.data;

    await connectToDatabase();

    await MessageReaction.deleteOne({
      messageId: new mongoose.Types.ObjectId(messageId),
      userId: new mongoose.Types.ObjectId(user.userId),
      reaction,
    });

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Reaction error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
