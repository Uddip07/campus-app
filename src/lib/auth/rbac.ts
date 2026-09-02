import { UserRole, UserStatus, RoomType } from "../types";

export interface UserAuthContext {
  userId: string;
  role: UserRole;
  status: UserStatus;
  cohortId: string;
  isMutedOrBanned: boolean;
}

export interface RoomAuthContext {
  roomId: string;
  type: RoomType;
  cohortId: string | null;
}

/**
 * Checks if a user has read access to a specific room.
 */
export function canAccessRoom(
  user: Pick<UserAuthContext, "role" | "cohortId" | "status">,
  room: Pick<RoomAuthContext, "type" | "cohortId">
): boolean {
  if (user.status === "banned") {
    return false;
  }

  // Staff roles have supervisory access to all rooms
  if (["moderator", "admin", "super_admin"].includes(user.role)) {
    return true;
  }

  if (room.type === "global") {
    return true;
  }

  if (room.type === "cohort") {
    return Boolean(room.cohortId && user.cohortId === room.cohortId);
  }

  if (room.type === "alumni") {
    return user.role === "alumni";
  }

  return false;
}

/**
 * Checks if a user can write messages or reactions in a room.
 */
export function canWriteInRoom(
  user: Pick<UserAuthContext, "role" | "cohortId" | "status" | "isMutedOrBanned">,
  room: Pick<RoomAuthContext, "type" | "cohortId">
): boolean {
  if (user.status !== "active" || user.isMutedOrBanned) {
    return false;
  }

  return canAccessRoom(user, room);
}

/**
 * Checks if a user can create or manage announcements.
 */
export function canManageAnnouncements(role: UserRole): boolean {
  return ["admin", "super_admin"].includes(role);
}

/**
 * Checks if a user can review reports and perform moderation actions.
 */
export function canModerate(role: UserRole): boolean {
  return ["moderator", "admin", "super_admin"].includes(role);
}

/**
 * Checks if a user can perform privileged identity resolution.
 * Strictly restricted to super_admin.
 */
export function canResolveIdentity(role: UserRole): boolean {
  return role === "super_admin";
}

/**
 * Checks if a user can view full audit trails.
 */
export function canViewAuditLogs(role: UserRole): boolean {
  return role === "super_admin";
}
