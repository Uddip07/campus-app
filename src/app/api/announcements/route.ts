import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { connectToDatabase } from "@/db/mongodb";
import { Announcement, AnnouncementAttachment } from "@/db/models";
import { AnnouncementDTO } from "@/lib/types";
import mongoose from "mongoose";

export async function GET() {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json(
        { error: "Authenticated user is required" },
        { status: 401 }
      );
    }

    await connectToDatabase();

    const now = new Date();

    // Base filter: published and not expired
    const timeFilter: Record<string, any> = {
      publishedAt: { $lte: now },
      $or: [{ expiresAt: null }, { expiresAt: { $gt: now } }],
    };

    let audienceFilter: Record<string, any>;
    if (["admin", "super_admin", "moderator"].includes(user.role)) {
      audienceFilter = timeFilter;
    } else if (user.role === "alumni") {
      audienceFilter = {
        ...timeFilter,
        audienceType: { $in: ["all", "alumni"] },
      };
    } else {
      // Regular student
      const userCohortObjectId = mongoose.Types.ObjectId.isValid(user.cohortId)
        ? new mongoose.Types.ObjectId(user.cohortId)
        : null;

      audienceFilter = {
        ...timeFilter,
        $or: [
          { audienceType: "all" },
          { audienceType: "cohort", cohortId: userCohortObjectId },
        ],
      };
    }

    const announcements = await Announcement.find(audienceFilter)
      .sort({ isPinned: -1, publishedAt: -1 })
      .populate<{ cohortId: { _id: any; graduationYear: number } | null }>("cohortId")
      .lean();

    const announcementIds = announcements.map((a) => a._id);
    const attachments = await AnnouncementAttachment.find({
      announcementId: { $in: announcementIds },
    }).lean();

    const attachmentMap = new Map<string, any[]>();
    for (const att of attachments) {
      const aId = att.announcementId.toString();
      if (!attachmentMap.has(aId)) {
        attachmentMap.set(aId, []);
      }
      attachmentMap.get(aId)!.push(att);
    }

    const dtoList: AnnouncementDTO[] = announcements.map((a) => {
      const aId = a._id.toString();
      const cohortData = a.cohortId as any;
      const attList = attachmentMap.get(aId) || [];

      return {
        id: aId,
        title: a.title,
        content: a.content,
        audienceType: a.audienceType,
        cohortYear: cohortData?.graduationYear ?? null,
        isPinned: a.isPinned,
        publishedAt: a.publishedAt ? new Date(a.publishedAt).toISOString() : null,
        expiresAt: a.expiresAt ? new Date(a.expiresAt).toISOString() : null,
        createdAt: new Date(a.createdAt).toISOString(),
        attachments: attList.map((att) => ({
          id: att._id.toString(),
          fileName: att.fileName,
          mimeType: att.mimeType,
          fileSize: att.fileSize,
          downloadUrl: att.storagePath,
        })),
      };
    });

    return NextResponse.json({ announcements: dtoList });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Error fetching announcements";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
