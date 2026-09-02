import { describe, it, expect } from "vitest";
import {
  canAccessRoom,
  canWriteInRoom,
  canManageAnnouncements,
  canModerate,
  canResolveIdentity,
  canViewAuditLogs,
} from "@/lib/auth/rbac";

describe("RBAC and Room Authorization Permissions", () => {
  const studentCohortA = {
    role: "student" as const,
    cohortId: "cohort-2029",
    status: "active" as const,
    isMutedOrBanned: false,
  };

  const studentCohortB = {
    role: "student" as const,
    cohortId: "cohort-2028",
    status: "active" as const,
    isMutedOrBanned: false,
  };

  const alumniUser = {
    role: "alumni" as const,
    cohortId: "cohort-2024",
    status: "active" as const,
    isMutedOrBanned: false,
  };

  const moderatorUser = {
    role: "moderator" as const,
    cohortId: "cohort-2027",
    status: "active" as const,
    isMutedOrBanned: false,
  };

  const adminUser = {
    role: "admin" as const,
    cohortId: "cohort-2026",
    status: "active" as const,
    isMutedOrBanned: false,
  };

  const superAdminUser = {
    role: "super_admin" as const,
    cohortId: "cohort-2025",
    status: "active" as const,
    isMutedOrBanned: false,
  };

  const globalRoom = { type: "global" as const, cohortId: null };
  const roomCohortA = { type: "cohort" as const, cohortId: "cohort-2029" };
  const roomCohortB = { type: "cohort" as const, cohortId: "cohort-2028" };
  const alumniRoom = { type: "alumni" as const, cohortId: null };

  describe("Room Access", () => {
    it("allows all active users to access global room", () => {
      expect(canAccessRoom(studentCohortA, globalRoom)).toBe(true);
      expect(canAccessRoom(alumniUser, globalRoom)).toBe(true);
      expect(canAccessRoom(moderatorUser, globalRoom)).toBe(true);
    });

    it("allows students to access only their assigned cohort room", () => {
      expect(canAccessRoom(studentCohortA, roomCohortA)).toBe(true);
      expect(canAccessRoom(studentCohortA, roomCohortB)).toBe(false);
      expect(canAccessRoom(studentCohortB, roomCohortA)).toBe(false);
      expect(canAccessRoom(studentCohortB, roomCohortB)).toBe(true);
    });

    it("prevents active students from accessing the alumni room", () => {
      expect(canAccessRoom(studentCohortA, alumniRoom)).toBe(false);
      expect(canAccessRoom(studentCohortB, alumniRoom)).toBe(false);
    });

    it("allows alumni to access alumni room", () => {
      expect(canAccessRoom(alumniUser, alumniRoom)).toBe(true);
    });

    it("allows moderators and admins supervisory access to all rooms", () => {
      expect(canAccessRoom(moderatorUser, roomCohortA)).toBe(true);
      expect(canAccessRoom(moderatorUser, roomCohortB)).toBe(true);
      expect(canAccessRoom(moderatorUser, alumniRoom)).toBe(true);

      expect(canAccessRoom(adminUser, roomCohortA)).toBe(true);
      expect(canAccessRoom(superAdminUser, alumniRoom)).toBe(true);
    });

    it("denies access to any room if user status is banned", () => {
      const bannedUser = { ...studentCohortA, status: "banned" as const };
      expect(canAccessRoom(bannedUser, globalRoom)).toBe(false);
      expect(canAccessRoom(bannedUser, roomCohortA)).toBe(false);
    });
  });

  describe("Room Write Permissions", () => {
    it("denies writing if user is muted or banned", () => {
      const mutedUser = { ...studentCohortA, isMutedOrBanned: true };
      expect(canWriteInRoom(mutedUser, roomCohortA)).toBe(false);

      const suspendedUser = { ...studentCohortA, status: "suspended" as const };
      expect(canWriteInRoom(suspendedUser, roomCohortA)).toBe(false);
    });

    it("allows writing if user is active and has room access", () => {
      expect(canWriteInRoom(studentCohortA, roomCohortA)).toBe(true);
    });
  });

  describe("Administrative Capabilities", () => {
    it("permits only admin and super_admin to manage announcements", () => {
      expect(canManageAnnouncements("student")).toBe(false);
      expect(canManageAnnouncements("alumni")).toBe(false);
      expect(canManageAnnouncements("moderator")).toBe(false);
      expect(canManageAnnouncements("admin")).toBe(true);
      expect(canManageAnnouncements("super_admin")).toBe(true);
    });

    it("permits moderator, admin, and super_admin to moderate reports", () => {
      expect(canModerate("student")).toBe(false);
      expect(canModerate("alumni")).toBe(false);
      expect(canModerate("moderator")).toBe(true);
      expect(canModerate("admin")).toBe(true);
      expect(canModerate("super_admin")).toBe(true);
    });

    it("strictly restricts identity resolution to super_admin only", () => {
      expect(canResolveIdentity("student")).toBe(false);
      expect(canResolveIdentity("alumni")).toBe(false);
      expect(canResolveIdentity("moderator")).toBe(false);
      expect(canResolveIdentity("admin")).toBe(false);
      expect(canResolveIdentity("super_admin")).toBe(true);
    });

    it("strictly restricts audit log inspection to super_admin only", () => {
      expect(canViewAuditLogs("student")).toBe(false);
      expect(canViewAuditLogs("moderator")).toBe(false);
      expect(canViewAuditLogs("admin")).toBe(false);
      expect(canViewAuditLogs("super_admin")).toBe(true);
    });
  });
});
