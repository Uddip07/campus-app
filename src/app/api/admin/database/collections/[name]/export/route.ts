import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { connectToDatabase } from "@/db/mongodb";
import * as models from "@/db/models";
import { COLLECTION_NAMES, CollectionName, AuditLog } from "@/db/models";
import mongoose from "mongoose";

export const dynamic = "force-dynamic";

const modelMap: Record<CollectionName, any> = {
  users: models.User,
  cohorts: models.Cohort,
  anonymousidentities: models.AnonymousIdentity,
  rooms: models.Room,
  messages: models.Message,
  messagereactions: models.MessageReaction,
  reports: models.Report,
  bans: models.Ban,
  announcements: models.Announcement,
  announcementattachments: models.AnnouncementAttachment,
  auditlogs: models.AuditLog,
  notificationdevices: models.NotificationDevice,
};

interface RouteParams {
  params: {
    name: string;
  };
}

export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!["admin", "super_admin"].includes(user.role)) {
      return NextResponse.json(
        { error: "Forbidden: Admin or Super Admin privileges required." },
        { status: 403 }
      );
    }

    const collectionName = params.name.toLowerCase() as CollectionName;
    if (!COLLECTION_NAMES.includes(collectionName)) {
      return NextResponse.json(
        { error: `Invalid collection '${params.name}'. Valid collections: ${COLLECTION_NAMES.join(", ")}` },
        { status: 400 }
      );
    }

    await connectToDatabase();
    const model = modelMap[collectionName];

    // Read up to 1000 documents for export
    const rawDocs = await model
      .find({})
      .sort({ createdAt: -1, _id: -1 })
      .limit(1000)
      .lean();

    const sanitizedDocs = rawDocs.map((doc: any) => {
      const sanitized: Record<string, any> = {};
      for (const [key, value] of Object.entries(doc)) {
        if (key === "__v") continue;
        if (value instanceof mongoose.Types.ObjectId || (value && typeof value === "object" && "_bsontype" in value)) {
          sanitized[key] = value.toString();
        } else if (value instanceof Date) {
          sanitized[key] = value.toISOString();
        } else if (Array.isArray(value)) {
          sanitized[key] = value.map((item) =>
            item instanceof mongoose.Types.ObjectId ? item.toString() : item
          );
        } else {
          sanitized[key] = value;
        }
      }
      return sanitized;
    });

    // Record audit log entry for compliance
    if (mongoose.Types.ObjectId.isValid(user.userId)) {
      await AuditLog.create({
        actorId: new mongoose.Types.ObjectId(user.userId),
        action: "database_collection_export",
        targetType: "collection",
        targetId: collectionName,
        metadata: {
          exportedCount: sanitizedDocs.length,
          actorRole: user.role,
          timestamp: new Date().toISOString(),
        },
      }).catch((e) => {
        console.error("[AuditLog] Failed to log collection export:", e);
      });
    }

    const jsonString = JSON.stringify(sanitizedDocs, null, 2);

    return new NextResponse(jsonString, {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="campusconnect-${collectionName}.json"`,
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Error exporting collection";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
