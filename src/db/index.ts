import { connectToDatabase, getMongoHealth, isMongoConfigured, mongoose } from "./mongodb";
import * as models from "./models";

export * from "./mongodb";
export * from "./models";

/**
 * Backward compatibility helper for legacy database URL normalization tests.
 */
export function normalizeDatabaseUrl(
  raw: string | undefined
): { url: string; isTransactionPooler: boolean } | null {
  if (!raw) return null;
  try {
    const parsed = new URL(raw);
    let isTransactionPooler = parsed.port === "6543";

    if (parsed.hostname.startsWith("db.") && parsed.hostname.endsWith(".supabase.co")) {
      const projectRef = parsed.hostname.replace(/^db\./, "").replace(/\.supabase\.co$/, "");
      const region = process.env.SUPABASE_POOLER_REGION || "ap-southeast-1";
      parsed.hostname = `aws-0-${region}.pooler.supabase.com`;
      if (parsed.username === "postgres") {
        parsed.username = `postgres.${projectRef}`;
      }
      if (parsed.port === "6543") {
        isTransactionPooler = true;
      } else {
        parsed.port = "5432";
      }
      if (!parsed.searchParams.has("sslmode")) {
        parsed.searchParams.set("sslmode", "require");
      }
      return { url: parsed.toString(), isTransactionPooler };
    }

    if (parsed.hostname.includes("pooler.supabase.com") && parsed.port === "6543") {
      isTransactionPooler = true;
    }

    return { url: raw, isTransactionPooler };
  } catch {
    return { url: raw, isTransactionPooler: false };
  }
}

/**
 * High-level repository object providing typed access to all 12 MongoDB collections.
 */
export const db = {
  connect: connectToDatabase,
  health: getMongoHealth,
  isConfigured: isMongoConfigured,
  models,
  User: models.User,
  Cohort: models.Cohort,
  AnonymousIdentity: models.AnonymousIdentity,
  Room: models.Room,
  Message: models.Message,
  MessageReaction: models.MessageReaction,
  Report: models.Report,
  Ban: models.Ban,
  Announcement: models.Announcement,
  AnnouncementAttachment: models.AnnouncementAttachment,
  AuditLog: models.AuditLog,
  NotificationDevice: models.NotificationDevice,
};

export default db;
