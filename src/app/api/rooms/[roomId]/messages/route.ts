import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUser } from "@/lib/auth/session";
import { canAccessRoom, canWriteInRoom } from "@/lib/auth/rbac";
import { rateLimitMessage } from "@/lib/rate-limit/limiter";
import { broadcastNewMessage } from "@/lib/realtime/broadcast";
import { connectToDatabase } from "@/db/mongodb";
import { Room, Message, MessageReaction, AnonymousIdentity, User } from "@/db/models";
import {
  decodeCompositeCursor,
  encodeCompositeCursor,
  buildCursorQuery,
} from "@/lib/pagination/cursor";
import { MessageDTO, ReactionCountDTO } from "@/lib/types";
import mongoose from "mongoose";

const postMessageSchema = z.object({
  content: z.string().trim().min(1, "Message cannot be empty").max(4000, "Message too long"),
  replyToId: z.string().optional().nullable(),
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

    await connectToDatabase();

    const room = mongoose.Types.ObjectId.isValid(roomId)
      ? await Room.findById(roomId)
      : null;

    if (!room) {
      return NextResponse.json({ error: "Room not found" }, { status: 404 });
    }

    const cohortIdStr = room.cohortId ? room.cohortId.toString() : null;
    if (
      !canAccessRoom(
        { role: user.role, cohortId: user.cohortId, status: user.status },
        { type: room.type, cohortId: cohortIdStr }
      )
    ) {
      return NextResponse.json(
        { error: "You are not authorized to access this room." },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(req.url);
    const beforeCursorParam = searchParams.get("before");
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get("limit") || "50", 10)));

    // Decode composite cursor
    const cursor = decodeCompositeCursor(beforeCursorParam);

    // Base filter
    const baseFilter: Record<string, any> = {
      roomId: room._id,
      moderationStatus: "approved",
      deletedAt: null,
    };

    // Apply stable composite cursor filter (createdAt, _id)
    const query = buildCursorQuery(cursor, baseFilter);

    // Query messages with descending sort on (createdAt, _id)
    const rawMessages = await Message.find(query)
      .sort({ createdAt: -1, _id: -1 })
      .limit(limit + 1)
      .lean();

    const hasMore = rawMessages.length > limit;
    const pagedMessages = hasMore ? rawMessages.slice(0, limit) : rawMessages;

    // Collect message IDs and sender IDs
    const messageObjectIds = pagedMessages.map((m) => m._id);
    const senderObjectIds = Array.from(new Set(pagedMessages.map((m) => m.senderId.toString()))).map(
      (id) => new mongoose.Types.ObjectId(id)
    );

    // Fetch active anonymous identities for all senders in one query
    const identities = await AnonymousIdentity.find({
      userId: { $in: senderObjectIds },
      isActive: true,
    })
      .sort({ createdAt: -1 })
      .lean();

    const identityMap = new Map<string, { displayName: string; avatarSeed: string | null }>();
    for (const ident of identities) {
      const uId = ident.userId.toString();
      if (!identityMap.has(uId)) {
        identityMap.set(uId, {
          displayName: ident.displayName,
          avatarSeed: ident.avatarSeed,
        });
      }
    }

    // Fetch reactions for these messages in one aggregation query
    const userObjectId = mongoose.Types.ObjectId.isValid(user.userId)
      ? new mongoose.Types.ObjectId(user.userId)
      : null;

    const allReactions = await MessageReaction.find({
      messageId: { $in: messageObjectIds },
    }).lean();

    const reactionsMap = new Map<string, Map<string, { count: number; hasReacted: boolean }>>();
    for (const rx of allReactions) {
      const mId = rx.messageId.toString();
      if (!reactionsMap.has(mId)) {
        reactionsMap.set(mId, new Map());
      }
      const msgRxMap = reactionsMap.get(mId)!;
      const current = msgRxMap.get(rx.reaction) || { count: 0, hasReacted: false };
      current.count += 1;
      if (userObjectId && rx.userId.toString() === userObjectId.toString()) {
        current.hasReacted = true;
      }
      msgRxMap.set(rx.reaction, current);
    }

    // Fetch reply counts
    const replyCounts = await Message.aggregate([
      {
        $match: {
          replyToId: { $in: messageObjectIds },
          moderationStatus: "approved",
          deletedAt: null,
        },
      },
      {
        $group: {
          _id: "$replyToId",
          count: { $sum: 1 },
        },
      },
    ]);

    const replyCountMap = new Map<string, number>();
    for (const rc of replyCounts) {
      if (rc._id) {
        replyCountMap.set(rc._id.toString(), rc.count);
      }
    }

    // Construct response DTOs
    const sanitizedMessages: MessageDTO[] = pagedMessages.map((msg) => {
      const msgIdStr = msg._id.toString();
      const senderIdStr = msg.senderId.toString();
      const senderIdentity = identityMap.get(senderIdStr);

      const msgRxMap = reactionsMap.get(msgIdStr);
      const reactions: ReactionCountDTO[] = msgRxMap
        ? Array.from(msgRxMap.entries()).map(([reaction, data]) => ({
            reaction,
            count: data.count,
            hasReacted: data.hasReacted,
          }))
        : [];

      return {
        id: msgIdStr,
        roomId: msg.roomId.toString(),
        content: msg.content,
        replyToId: msg.replyToId ? msg.replyToId.toString() : null,
        replyCount: replyCountMap.get(msgIdStr) || 0,
        reactions,
        sender: {
          displayName: senderIdentity?.displayName || "AnonymousStudent",
          avatarSeed: senderIdentity?.avatarSeed || null,
        },
        createdAt: new Date(msg.createdAt).toISOString(),
        isSender: senderIdStr === user.userId,
        moderationStatus: msg.moderationStatus,
      };
    });

    // Generate stable composite cursor for the next page
    let nextCursor: string | null = null;
    if (hasMore && pagedMessages.length > 0) {
      const lastMsg = pagedMessages[pagedMessages.length - 1];
      nextCursor = encodeCompositeCursor({
        createdAt: new Date(lastMsg.createdAt),
        id: lastMsg._id.toString(),
      });
    }

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

    await connectToDatabase();

    const room = mongoose.Types.ObjectId.isValid(roomId)
      ? await Room.findById(roomId)
      : null;

    if (!room) {
      return NextResponse.json({ error: "Room not found" }, { status: 404 });
    }

    const cohortIdStr = room.cohortId ? room.cohortId.toString() : null;
    if (
      !canWriteInRoom(
        {
          role: user.role,
          cohortId: user.cohortId,
          status: user.status,
          isMutedOrBanned: user.isMutedOrBanned,
        },
        { type: room.type, cohortId: cohortIdStr }
      )
    ) {
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

    const replyObjectId =
      replyToId && mongoose.Types.ObjectId.isValid(replyToId)
        ? new mongoose.Types.ObjectId(replyToId)
        : null;

    // Persist message in MongoDB
    const newMessage = await Message.create({
      roomId: room._id,
      senderId: new mongoose.Types.ObjectId(user.userId),
      content,
      replyToId: replyObjectId,
      moderationStatus: "approved",
    });

    const messageDTO: MessageDTO = {
      id: newMessage._id.toString(),
      roomId: room._id.toString(),
      content: newMessage.content,
      replyToId: newMessage.replyToId ? newMessage.replyToId.toString() : null,
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
