import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { connectToDatabase } from "@/db/mongodb";
import * as models from "@/db/models";
import { COLLECTION_NAMES, CollectionName } from "@/db/models";
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

    const { searchParams } = new URL(req.url);
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get("limit") || "20", 10)));
    const searchId = searchParams.get("searchId")?.trim();
    const searchField = searchParams.get("searchField")?.trim();
    const searchQuery = searchParams.get("searchQuery")?.trim();

    const filter: Record<string, any> = {};

    if (searchId) {
      if (mongoose.Types.ObjectId.isValid(searchId)) {
        filter._id = new mongoose.Types.ObjectId(searchId);
      } else {
        filter._id = searchId;
      }
    } else if (searchField && searchQuery) {
      // Escape regex special characters
      const escaped = searchQuery.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      if (searchField.endsWith("Id") && mongoose.Types.ObjectId.isValid(searchQuery)) {
        filter[searchField] = new mongoose.Types.ObjectId(searchQuery);
      } else {
        filter[searchField] = { $regex: escaped, $options: "i" };
      }
    }

    const total = await model.countDocuments(filter);
    const totalPages = Math.ceil(total / limit) || 1;
    const skip = (page - 1) * limit;

    const rawDocs = await model
      .find(filter)
      .sort({ createdAt: -1, _id: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    // Clean serialization of documents
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

      // If viewing notificationdevices, mask part of pushToken for safety
      if (collectionName === "notificationdevices" && sanitized.pushToken) {
        sanitized.pushToken = `${sanitized.pushToken.slice(0, 6)}...[REDACTED]`;
      }

      return sanitized;
    });

    return NextResponse.json({
      collection: collectionName,
      modelName: model.modelName,
      page,
      limit,
      total,
      totalPages,
      documents: sanitizedDocs,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Error reading collection";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
