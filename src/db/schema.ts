import {
  pgTable,
  pgEnum,
  uuid,
  text,
  integer,
  timestamp,
  boolean,
  bigint,
  jsonb,
  primaryKey,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { relations, sql } from "drizzle-orm";

// Enums matching infrastructure/sql/001_initial.sql
export const userRoleEnum = pgEnum("user_role", [
  "student",
  "alumni",
  "moderator",
  "admin",
  "super_admin",
]);

export const userStatusEnum = pgEnum("user_status", [
  "active",
  "suspended",
  "banned",
]);

export const roomTypeEnum = pgEnum("room_type", [
  "global",
  "cohort",
  "alumni",
]);

export const moderationStatusEnum = pgEnum("moderation_status", [
  "pending",
  "approved",
  "rejected",
  "removed",
]);

export const reportStatusEnum = pgEnum("report_status", [
  "pending",
  "resolved",
  "dismissed",
]);

export const announcementAudienceEnum = pgEnum("announcement_audience", [
  "all",
  "cohort",
  "alumni",
]);

export const banTypeEnum = pgEnum("ban_type", [
  "mute",
  "temp_ban",
  "permanent_ban",
]);

// 1. Cohorts
export const cohorts = pgTable("cohorts", {
  id: uuid("id").primaryKey().defaultRandom(),
  graduationYear: integer("graduation_year").notNull().unique(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// 2. Users
export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    collegeId: text("college_id").notNull().unique(),
    collegeEmail: text("college_email").notNull().unique(),
    enrollmentYear: integer("enrollment_year").notNull(),
    programCode: text("program_code").notNull(),
    rollNumber: text("roll_number").notNull(),
    cohortId: uuid("cohort_id")
      .notNull()
      .references(() => cohorts.id),
    role: userRoleEnum("role").notNull().default("student"),
    status: userStatusEnum("status").notNull().default("active"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_users_cohort").on(table.cohortId),
    index("idx_users_college_id").on(table.collegeId),
  ]
);

// 3. Anonymous Identities
export const anonymousIdentities = pgTable(
  "anonymous_identities",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    displayName: text("display_name").notNull().unique(),
    avatarSeed: text("avatar_seed"),
    validFrom: timestamp("valid_from", { withTimezone: true }).notNull().defaultNow(),
    validUntil: timestamp("valid_until", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_anonymous_identity_user").on(table.userId),
  ]
);

// 4. Rooms
export const rooms = pgTable(
  "rooms",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    type: roomTypeEnum("type").notNull(),
    name: text("name").notNull(),
    cohortId: uuid("cohort_id").references(() => cohorts.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("uniq_cohort_room")
      .on(table.cohortId)
      .where(sql`${table.type} = 'cohort'`),
  ]
);

// 5. Messages
export const messages = pgTable(
  "messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    roomId: uuid("room_id")
      .notNull()
      .references(() => rooms.id, { onDelete: "cascade" }),
    senderId: uuid("sender_id")
      .notNull()
      .references(() => users.id),
    content: text("content").notNull(),
    replyToId: uuid("reply_to_id"),
    moderationStatus: moderationStatusEnum("moderation_status")
      .notNull()
      .default("approved"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    editedAt: timestamp("edited_at", { withTimezone: true }),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (table) => [
    index("idx_messages_room_time").on(table.roomId, table.createdAt, table.id),
    index("idx_messages_sender").on(table.senderId, table.createdAt),
  ]
);

// 6. Message Reactions
export const messageReactions = pgTable(
  "message_reactions",
  {
    messageId: uuid("message_id")
      .notNull()
      .references(() => messages.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    reaction: text("reaction").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.messageId, table.userId, table.reaction] }),
  ]
);

// 7. Reports
export const reports = pgTable(
  "reports",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    messageId: uuid("message_id")
      .notNull()
      .references(() => messages.id, { onDelete: "cascade" }),
    reporterId: uuid("reporter_id")
      .notNull()
      .references(() => users.id),
    reason: text("reason").notNull(),
    description: text("description"),
    status: reportStatusEnum("status").notNull().default("pending"),
    reviewedBy: uuid("reviewed_by").references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
  },
  (table) => [
    index("idx_reports_status").on(table.status, table.createdAt),
  ]
);

// 8. Bans
export const bans = pgTable(
  "bans",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: banTypeEnum("type").notNull(),
    reason: text("reason").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    createdBy: uuid("created_by")
      .notNull()
      .references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  }
);

// 9. Announcements
export const announcements = pgTable(
  "announcements",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    title: text("title").notNull(),
    content: text("content").notNull(),
    authorId: uuid("author_id")
      .notNull()
      .references(() => users.id),
    audienceType: announcementAudienceEnum("audience_type").notNull(),
    cohortId: uuid("cohort_id").references(() => cohorts.id),
    isPinned: boolean("is_pinned").notNull().default(false),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_announcements_visibility").on(
      table.audienceType,
      table.cohortId,
      table.publishedAt
    ),
  ]
);

// 10. Announcement Attachments
export const announcementAttachments = pgTable(
  "announcement_attachments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    announcementId: uuid("announcement_id")
      .notNull()
      .references(() => announcements.id, { onDelete: "cascade" }),
    storagePath: text("storage_path").notNull(),
    fileName: text("file_name").notNull(),
    mimeType: text("mime_type").notNull(),
    fileSize: bigint("file_size", { mode: "number" }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  }
);

// 11. Audit Logs
export const auditLogs = pgTable(
  "audit_logs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    actorId: uuid("actor_id")
      .notNull()
      .references(() => users.id),
    action: text("action").notNull(),
    targetType: text("target_type").notNull(),
    targetId: uuid("target_id"),
    metadata: jsonb("metadata").notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_audit_created").on(table.createdAt),
  ]
);

// 12. Notification Devices
export const notificationDevices = pgTable(
  "notification_devices",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    pushToken: text("push_token").notNull().unique(),
    platform: text("platform").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).notNull().defaultNow(),
  }
);

// Relations
export const cohortsRelations = relations(cohorts, ({ many }) => ({
  users: many(users),
  rooms: many(rooms),
  announcements: many(announcements),
}));

export const usersRelations = relations(users, ({ one, many }) => ({
  cohort: one(cohorts, {
    fields: [users.cohortId],
    references: [cohorts.id],
  }),
  anonymousIdentities: many(anonymousIdentities),
  messages: many(messages),
  reactions: many(messageReactions),
  reportsSubmitted: many(reports, { relationName: "reporter" }),
  reportsReviewed: many(reports, { relationName: "reviewer" }),
  bans: many(bans, { relationName: "bannedUser" }),
  announcements: many(announcements),
  auditLogs: many(auditLogs),
}));

export const anonymousIdentitiesRelations = relations(anonymousIdentities, ({ one }) => ({
  user: one(users, {
    fields: [anonymousIdentities.userId],
    references: [users.id],
  }),
}));

export const roomsRelations = relations(rooms, ({ one, many }) => ({
  cohort: one(cohorts, {
    fields: [rooms.cohortId],
    references: [cohorts.id],
  }),
  messages: many(messages),
}));

export const messagesRelations = relations(messages, ({ one, many }) => ({
  room: one(rooms, {
    fields: [messages.roomId],
    references: [rooms.id],
  }),
  sender: one(users, {
    fields: [messages.senderId],
    references: [users.id],
  }),
  replyTo: one(messages, {
    fields: [messages.replyToId],
    references: [messages.id],
    relationName: "replies",
  }),
  replies: many(messages, { relationName: "replies" }),
  reactions: many(messageReactions),
  reports: many(reports),
}));

export const messageReactionsRelations = relations(messageReactions, ({ one }) => ({
  message: one(messages, {
    fields: [messageReactions.messageId],
    references: [messages.id],
  }),
  user: one(users, {
    fields: [messageReactions.userId],
    references: [users.id],
  }),
}));

export const reportsRelations = relations(reports, ({ one }) => ({
  message: one(messages, {
    fields: [reports.messageId],
    references: [messages.id],
  }),
  reporter: one(users, {
    fields: [reports.reporterId],
    references: [users.id],
    relationName: "reporter",
  }),
  reviewer: one(users, {
    fields: [reports.reviewedBy],
    references: [users.id],
    relationName: "reviewer",
  }),
}));

export const announcementsRelations = relations(announcements, ({ one, many }) => ({
  author: one(users, {
    fields: [announcements.authorId],
    references: [users.id],
  }),
  cohort: one(cohorts, {
    fields: [announcements.cohortId],
    references: [cohorts.id],
  }),
  attachments: many(announcementAttachments),
}));

export const announcementAttachmentsRelations = relations(
  announcementAttachments,
  ({ one }) => ({
    announcement: one(announcements, {
      fields: [announcementAttachments.announcementId],
      references: [announcements.id],
    }),
  })
);

export const auditLogsRelations = relations(auditLogs, ({ one }) => ({
  actor: one(users, {
    fields: [auditLogs.actorId],
    references: [users.id],
  }),
}));

