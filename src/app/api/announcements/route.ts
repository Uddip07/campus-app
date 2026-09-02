import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { db, schema } from "@/db";
import { eq, and, or, isNull, lte, gt, desc } from "drizzle-orm";
import { AnnouncementDTO } from "@/lib/types";

export async function GET() {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json(
        { error: "Authenticated user is required" },
        { status: 401 }
      );
    }

    const now = new Date();

    // Base filter: published and not expired
    const timeConditions = and(
      lte(schema.announcements.publishedAt, now),
      or(isNull(schema.announcements.expiresAt), gt(schema.announcements.expiresAt, now))
    );

    // Audience filter based on user role and cohort
    let audienceCondition;
    if (["admin", "super_admin", "moderator"].includes(user.role)) {
      audienceCondition = timeConditions;
    } else if (user.role === "alumni") {
      audienceCondition = and(
        timeConditions,
        or(
          eq(schema.announcements.audienceType, "all"),
          eq(schema.announcements.audienceType, "alumni")
        )
      );
    } else {
      // Regular student
      audienceCondition = and(
        timeConditions,
        or(
          eq(schema.announcements.audienceType, "all"),
          and(
            eq(schema.announcements.audienceType, "cohort"),
            eq(schema.announcements.cohortId, user.cohortId)
          )
        )
      );
    }

    const announcements = await db.query.announcements.findMany({
      where: audienceCondition,
      orderBy: [
        desc(schema.announcements.isPinned),
        desc(schema.announcements.publishedAt),
      ],
      with: {
        cohort: true,
        attachments: true,
      },
    });

    const dtoList: AnnouncementDTO[] = announcements.map((a) => ({
      id: a.id,
      title: a.title,
      content: a.content,
      audienceType: a.audienceType,
      cohortYear: a.cohort?.graduationYear ?? null,
      isPinned: a.isPinned,
      publishedAt: a.publishedAt ? a.publishedAt.toISOString() : null,
      expiresAt: a.expiresAt ? a.expiresAt.toISOString() : null,
      createdAt: a.createdAt.toISOString(),
      attachments: a.attachments.map((att) => ({
        id: att.id,
        fileName: att.fileName,
        mimeType: att.mimeType,
        fileSize: att.fileSize,
        downloadUrl: att.storagePath,
      })),
    }));

    return NextResponse.json({ announcements: dtoList });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Error fetching announcements";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
