import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUser } from "@/lib/auth/session";
import { canManageAnnouncements } from "@/lib/auth/rbac";
import { rateLimitAnnouncement } from "@/lib/rate-limit/limiter";
import { logAuditEvent } from "@/lib/audit/logger";
import { connectToDatabase } from "@/db/mongodb";
import { Announcement } from "@/db/models/Announcement";
import mongoose from "mongoose";

const createAnnouncementSchema = z
  .object({
    title: z.string().trim().min(1).max(200),
    content: z.string().trim().min(1),
    audienceType: z.enum(["all", "cohort", "alumni"]),
    cohortId: z.string().optional().nullable(),
    isPinned: z.boolean().default(false),
    publishedAt: z.string().datetime().optional().nullable(),
    expiresAt: z.string().datetime().optional().nullable(),
  })
  .refine(
    (data) => {
      if (data.audienceType === "cohort" && !data.cohortId) {
        return false;
      }
      return true;
    },
    {
      message: "cohortId is required when audienceType is 'cohort'",
      path: ["cohortId"],
    }
  );

export async function POST(req: NextRequest) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!canManageAnnouncements(user.role)) {
      return NextResponse.json(
        { error: "You are not authorized to create announcements." },
        { status: 403 }
      );
    }

    const rate = await rateLimitAnnouncement(user.userId);
    if (!rate.allowed) {
      return NextResponse.json(
        { error: "Rate limit exceeded for announcement creation." },
        { status: 429 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const parseResult = createAnnouncementSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        { error: "Invalid announcement input", details: parseResult.error.format() },
        { status: 400 }
      );
    }

    const data = parseResult.data;
    const publishedAtDate = data.publishedAt ? new Date(data.publishedAt) : new Date();
    const expiresAtDate = data.expiresAt ? new Date(data.expiresAt) : null;

    await connectToDatabase();

    const cohortObjectId =
      data.cohortId && mongoose.Types.ObjectId.isValid(data.cohortId)
        ? new mongoose.Types.ObjectId(data.cohortId)
        : null;

    const newAnnouncement = await Announcement.create({
      title: data.title,
      content: data.content,
      authorId: new mongoose.Types.ObjectId(user.userId),
      audienceType: data.audienceType,
      cohortId: cohortObjectId,
      isPinned: data.isPinned,
      publishedAt: publishedAtDate,
      expiresAt: expiresAtDate,
    });

    await logAuditEvent({
      actorId: user.userId,
      action: "ANNOUNCEMENT_CREATED",
      targetType: "announcement",
      targetId: newAnnouncement._id.toString(),
      metadata: {
        title: newAnnouncement.title,
        audienceType: newAnnouncement.audienceType,
        isPinned: newAnnouncement.isPinned,
      },
    });

    return NextResponse.json({ success: true, announcement: newAnnouncement }, { status: 201 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Error creating announcement";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
