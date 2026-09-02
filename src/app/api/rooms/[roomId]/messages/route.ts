import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUser } from "@/lib/auth/session";
import { canAccessRoom, canWriteInRoom } from "@/lib/auth/rbac";
import { rateLimitMessage } from "@/lib/rate-limit/limiter";
import { broadcastNewMessage } from "@/lib/realtime/broadcast";
import { db, schema } from "@/db";
import { eq, and, desc, lt, count, sql, isNull } from "drizzle-orm";
import { MessageDTO, ReactionCountDTO } from "@/lib/types";

const postMessageSchema = z.object({
  content: z.string().trim().min(1, "Message cannot be empty").max(4000, "Message too long"),
  replyToId: z.string().uuid().optional().nullable(),
});

interface RouteParams {
  params: {
    roomId: string;
  };
}

export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json(
        { error: "Authenticated user is required" },
        { status: 401 }
      );
    }

    const { roomId } = params;

    const room = await db.query.rooms.findFirst({
      where: eq(schema.rooms.id, roomId),
    });

    if (!room) {
      return NextResponse.json({ error: "Room not found" }, { status: 404 });
    }

    if (!canAccessRoom(user, room)) {
      return NextResponse.json(
        { error: "You are not authorized to access this room." },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(req.url);
    const before = searchParams.get("before");
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get("limit") || "50", 10)));

    // Base conditions
    const conditions = [
      eq(schema.messages.roomId, roomId),
      eq(schema.messages.moderationStatus, "approved"),
      isNull(schema.messages.deletedAt),
    ];

    if (before) {
      const beforeDate = new Date(before);
      if (!isNaN(beforeDate.getTime())) {
        conditions.push(lt(schema.messages.createdAt, beforeDate));
      }
    }

    // Query messages with sender
    const rawMessages = await db.query.messages.findMany({
      where: and(...conditions),
      orderBy: [desc(schema.messages.createdAt), desc(schema.messages.id)],
      limit: limit + 1, // fetch 1 extra to determine next cursor
      with: {
        sender: {
          with: {
            anonymousIdentities: {
              orderBy: (identities, { desc }) => [desc(identities.createdAt)],
              limit: 1,
            },
          },
        },
        reactions: true,
      },
    });

    const hasMore = rawMessages.length > limit;
    const pagedMessages = hasMore ? rawMessages.slice(0, limit) : rawMessages;

    // Get reply counts for these messages
    const messageIds = pagedMessages.map((m) => m.id);
    const replyCountMap = new Map<string, number>();

    if (messageIds.length > 0) {
      const replyCounts = await db
        .select({
          replyToId: schema.messages.replyToId,
          count: count(),
        })
        .from(schema.messages)
        .where(
          and(
            sql`${schema.messages.replyToId} IN ${messageIds}`,
            eq(schema.messages.moderationStatus, "approved"),
            isNull(schema.messages.deletedAt)
          )
        )
        .groupBy(schema.messages.replyToId);

      for (const rc of replyCounts) {
        if (rc.replyToId) {
          replyCountMap.set(rc.replyToId, Number(rc.count));
        }
      }
    }

    const sanitizedMessages: MessageDTO[] = pagedMessages.map((msg) => {
      const senderIdentity = msg.sender.anonymousIdentities[0];
      const reactionsGrouped = new Map<string, { count: number; hasReacted: boolean }>();

      for (const rx of msg.reactions) {
        const existing = reactionsGrouped.get(rx.reaction) || { count: 0, hasReacted: false };
        existing.count += 1;
        if (rx.userId === user.userId) {
          existing.hasReacted = true;
        }
        reactionsGrouped.set(rx.reaction, existing);
      }

      const reactions: ReactionCountDTO[] = Array.from(reactionsGrouped.entries()).map(
        ([reaction, data]) => ({
          reaction,
          count: data.count,
          hasReacted: data.hasReacted,
        })
      );

      return {
        id: msg.id,
        roomId: msg.roomId,
        content: msg.content,
        replyToId: msg.replyToId,
        replyCount: replyCountMap.get(msg.id) || 0,
        reactions,
        sender: {
          displayName: senderIdentity?.displayName || "AnonymousStudent",
          avatarSeed: senderIdentity?.avatarSeed || null,
        },
        createdAt: msg.createdAt.toISOString(),
        isSender: msg.senderId === user.userId,
        moderationStatus: msg.moderationStatus,
      };
    });

    const nextCursor =
      hasMore && pagedMessages.length > 0
        ? pagedMessages[pagedMessages.length - 1].createdAt.toISOString()
        : null;

    return NextResponse.json({
      messages: sanitizedMessages,
      nextCursor,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Error loading messages";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: RouteParams) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json(
        { error: "Authenticated user is required" },
        { status: 401 }
      );
    }

    const { roomId } = params;

    const room = await db.query.rooms.findFirst({
      where: eq(schema.rooms.id, roomId),
    });

    if (!room) {
      return NextResponse.json({ error: "Room not found" }, { status: 404 });
    }

    if (!canWriteInRoom(user, room)) {
      if (user.isMutedOrBanned) {
        return NextResponse.json(
          { error: "You cannot post messages because your account is muted or banned." },
          { status: 403 }
        );
      }
      return NextResponse.json(
        { error: "You are not authorized to access this room." },
        { status: 403 }
      );
    }

    // Rate limiting check
    const rate = await rateLimitMessage(user.userId);
    if (!rate.allowed) {
      return NextResponse.json(
        { error: "Rate limit exceeded. Please wait a moment before sending another message." },
        { status: 429 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const parseResult = postMessageSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        { error: "Invalid message payload", details: parseResult.error.format() },
        { status: 400 }
      );
    }

    const { content, replyToId } = parseResult.data;

    // Insert message into PostgreSQL (source of truth)
    const [newMessage] = await db
      .insert(schema.messages)
      .values({
        roomId,
        senderId: user.userId,
        content,
        replyToId: replyToId || null,
        moderationStatus: "approved",
      })
      .returning();

    const messageDTO: MessageDTO = {
      id: newMessage.id,
      roomId: newMessage.roomId,
      content: newMessage.content,
      replyToId: newMessage.replyToId,
      replyCount: 0,
      reactions: [],
      sender: {
        displayName: user.anonymousName,
        avatarSeed: user.avatarSeed,
      },
      createdAt: newMessage.createdAt.toISOString(),
      isSender: true,
      moderationStatus: newMessage.moderationStatus,
    };

    // Broadcast to connected clients via Supabase Realtime
    await broadcastNewMessage(roomId, messageDTO);

    return NextResponse.json(messageDTO, { status: 201 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to send message";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
