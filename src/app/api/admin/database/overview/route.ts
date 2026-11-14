import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { connectToDatabase, getMongoHealth, mongoose } from "@/db/mongodb";
import * as models from "@/db/models";
import { COLLECTION_NAMES, CollectionName } from "@/db/models";

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

export async function GET() {
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

    await connectToDatabase();
    const health = getMongoHealth();

    // Fetch collection statistics and indexes
    const collectionsData = await Promise.all(
      COLLECTION_NAMES.map(async (name) => {
        const model = modelMap[name];
        let documentCount = 0;
        let indexes: Array<{ name: string; key: Record<string, any>; unique?: boolean }> = [];

        try {
          documentCount = await model.countDocuments();
        } catch {
          documentCount = 0;
        }

        try {
          const rawIndexes = await model.collection.indexes();
          indexes = rawIndexes.map((idx: any) => ({
            name: idx.name,
            key: idx.key,
            unique: Boolean(idx.unique),
          }));
        } catch {
          indexes = [];
        }

        return {
          name,
          modelName: model.modelName,
          documentCount,
          indexCount: indexes.length,
          indexes,
        };
      })
    );

    // Fetch database storage stats if supported by MongoDB cluster
    let storageStats: Record<string, any> = { available: false, reason: "unavailable" };
    try {
      if (mongoose.connection.db) {
        const stats = await mongoose.connection.db.stats();
        storageStats = {
          available: true,
          dbName: stats.db,
          collectionsCount: stats.collections,
          objectsCount: stats.objects,
          avgObjSize: stats.avgObjSize ? `${Math.round(stats.avgObjSize)} B` : "N/A",
          dataSize: stats.dataSize ? `${(stats.dataSize / 1024).toFixed(2)} KB` : "N/A",
          storageSize: stats.storageSize ? `${(stats.storageSize / 1024).toFixed(2)} KB` : "N/A",
          indexesCount: stats.indexes,
          indexSize: stats.indexSize ? `${(stats.indexSize / 1024).toFixed(2)} KB` : "N/A",
        };
      }
    } catch {
      storageStats = {
        available: false,
        reason: "Database stats command unavailable in restricted Atlas sandbox",
      };
    }

    const schemaRelationships = [
      { from: "users", to: "cohorts", foreignKey: "cohortId", type: "Many-to-One", required: true },
      { from: "anonymousidentities", to: "users", foreignKey: "userId", type: "Many-to-One", required: true },
      { from: "rooms", to: "cohorts", foreignKey: "cohortId", type: "Many-to-One (Nullable)", required: false },
      { from: "messages", to: "rooms", foreignKey: "roomId", type: "Many-to-One", required: true },
      { from: "messages", to: "users", foreignKey: "senderId", type: "Many-to-One", required: true },
      { from: "messages", to: "messages", foreignKey: "replyToId", type: "Recursive Self-Reference", required: false },
      { from: "messagereactions", to: "messages", foreignKey: "messageId", type: "Many-to-One", required: true },
      { from: "messagereactions", to: "users", foreignKey: "userId", type: "Many-to-One", required: true },
      { from: "reports", to: "messages", foreignKey: "messageId", type: "Many-to-One", required: true },
      { from: "reports", to: "users", foreignKey: "reporterId", type: "Many-to-One", required: true },
      { from: "reports", to: "users", foreignKey: "reviewedBy", type: "Many-to-One (Nullable)", required: false },
      { from: "bans", to: "users", foreignKey: "userId", type: "Many-to-One", required: true },
      { from: "bans", to: "users", foreignKey: "createdBy", type: "Many-to-One", required: true },
      { from: "announcements", to: "users", foreignKey: "authorId", type: "Many-to-One", required: true },
      { from: "announcements", to: "cohorts", foreignKey: "cohortId", type: "Many-to-One (Nullable)", required: false },
      { from: "announcementattachments", to: "announcements", foreignKey: "announcementId", type: "Many-to-One", required: true },
      { from: "auditlogs", to: "users", foreignKey: "actorId", type: "Many-to-One", required: true },
      { from: "notificationdevices", to: "users", foreignKey: "userId", type: "Many-to-One", required: true },
    ];

    return NextResponse.json({
      health,
      collections: collectionsData,
      storage: storageStats,
      relationships: schemaRelationships,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Error querying database overview";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
