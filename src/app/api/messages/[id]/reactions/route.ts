import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUser } from "@/lib/auth/session";
import { db, schema } from "@/db";
import { and, eq } from "drizzle-orm";

const ALLOWED_REACTIONS = ["like", "love", "laugh", "wow", "sad", "angry"] as const;

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
    const body = await req.json().catch(() => ({}));
    const parseResult = reactionSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        { error: "Invalid reaction. Allowed: " + ALLOWED_REACTIONS.join(", ") },
        { status: 400 }
      );
    }

    const { reaction } = parseResult.data;

    // Check message exists and is not deleted
    const message = await db.query.messages.findFirst({
      where: and(eq(schema.messages.id, messageId), eq(schema.messages.moderationStatus, "approved")),
    });

    if (!message) {
      return NextResponse.json({ error: "Message not found" }, { status: 404 });
    }

    // Toggle reaction: if exists delete, else insert
    const existing = await db.query.messageReactions.findFirst({
      where: and(
        eq(schema.messageReactions.messageId, messageId),
        eq(schema.messageReactions.userId, user.userId),
        eq(schema.messageReactions.reaction, reaction)
      ),
    });

    if (existing) {
      await db
        .delete(schema.messageReactions)
        .where(
          and(
            eq(schema.messageReactions.messageId, messageId),
            eq(schema.messageReactions.userId, user.userId),
            eq(schema.messageReactions.reaction, reaction)
          )
        );
      return NextResponse.json({ reacted: false, reaction });
    } else {
      await db.insert(schema.messageReactions).values({
        messageId,
        userId: user.userId,
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
    const body = await req.json().catch(() => ({}));
    const parseResult = reactionSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json({ error: "Invalid reaction" }, { status: 400 });
    }

    const { reaction } = parseResult.data;

    await db
      .delete(schema.messageReactions)
      .where(
        and(
          eq(schema.messageReactions.messageId, messageId),
          eq(schema.messageReactions.userId, user.userId),
          eq(schema.messageReactions.reaction, reaction)
        )
      );

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Reaction error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
