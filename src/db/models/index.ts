export * from "./Cohort";
export * from "./User";
export * from "./AnonymousIdentity";
export * from "./Room";
export * from "./Message";
export * from "./MessageReaction";
export * from "./Report";
export * from "./Ban";
export * from "./Announcement";
export * from "./AnnouncementAttachment";
export * from "./AuditLog";
export * from "./NotificationDevice";

export const COLLECTION_NAMES = [
  "users",
  "cohorts",
  "anonymousidentities",
  "rooms",
  "messages",
  "messagereactions",
  "reports",
  "bans",
  "announcements",
  "announcementattachments",
  "auditlogs",
  "notificationdevices",
] as const;

export type CollectionName = (typeof COLLECTION_NAMES)[number];
