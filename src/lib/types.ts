// Domain Models and Client DTOs

export type UserRole = "student" | "alumni" | "moderator" | "admin" | "super_admin";
export type UserStatus = "active" | "suspended" | "banned";
export type RoomType = "global" | "cohort" | "alumni";
export type ModerationStatus = "pending" | "approved" | "rejected" | "removed";
export type ReportStatus = "pending" | "resolved" | "dismissed";
export type AnnouncementAudience = "all" | "cohort" | "alumni";
export type BanType = "mute" | "temp_ban" | "permanent_ban";

// Safe public anonymous identity DTO (client facing)
export interface PublicAnonymousIdentity {
  displayName: string;
  avatarSeed: string | null;
}

// Current user profile DTO (never exposes college ID, email, roll number, or internal UUID)
export interface UserSessionProfile {
  anonymousName: string;
  avatarSeed: string | null;
  cohort: number; // graduation year
  role: UserRole;
  status: UserStatus;
  isMutedOrBanned: boolean;
}

// Room DTO
export interface RoomDTO {
  id: string;
  type: RoomType;
  name: string;
  cohortId: string | null;
  graduationYear?: number | null;
}

// Reaction DTO
export interface ReactionCountDTO {
  reaction: string;
  count: number;
  hasReacted: boolean;
}

// Message DTO (client facing: no internal user_id, college_id, or email)
export interface MessageDTO {
  id: string;
  roomId: string;
  content: string;
  replyToId: string | null;
  replyCount: number;
  reactions: ReactionCountDTO[];
  sender: PublicAnonymousIdentity;
  createdAt: string;
  isSender: boolean;
  moderationStatus: ModerationStatus;
}

// Announcement DTO
export interface AnnouncementDTO {
  id: string;
  title: string;
  content: string;
  audienceType: AnnouncementAudience;
  cohortYear: number | null;
  isPinned: boolean;
  publishedAt: string | null;
  expiresAt: string | null;
  createdAt: string;
  attachments: {
    id: string;
    fileName: string;
    mimeType: string;
    fileSize: number;
    downloadUrl: string;
  }[];
}

// Report DTO (moderator/admin facing)
export interface ReportDTO {
  id: string;
  messageId: string;
  messageContent: string;
  messageSenderAnonymousName: string;
  reporterAnonymousName: string;
  reason: string;
  description: string | null;
  status: ReportStatus;
  createdAt: string;
  resolvedAt: string | null;
}

// Admin Metrics DTO
export interface AdminStatsDTO {
  totalStudents: number;
  totalAlumni: number;
  pendingReports: number;
  totalAnnouncements: number;
}

// Audit Log DTO
export interface AuditLogDTO {
  id: string;
  actorAnonymousName: string;
  action: string;
  targetType: string;
  targetId: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
}
