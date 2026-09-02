import { describe, it, expect } from "vitest";
import {
  canAccessRoom,
  canWriteInRoom,
  canManageAnnouncements,
  canResolveIdentity,
} from "@/lib/auth/rbac";
import { sanitizeUserProfile, FullUserContext } from "@/lib/auth/session";

describe("Security Boundaries & Anonymity Enforcement", () => {
  const studentUser: FullUserContext = {
    userId: "11111111-1111-1111-1111-111111111111",
    collegeId: "2025UIT3090",
    collegeEmail: "2025uit3090@nsut.ac.in",
    role: "student",
    status: "active",
    cohortId: "cohort-uuid-2029",
    graduationYear: 2029,
    anonymousIdentityId: "anon-uuid-1",
    anonymousName: "AnonymousCosmicFox42",
    avatarSeed: "seed123",
    isMutedOrBanned: false,
  };

  const moderatorUser: FullUserContext = {
    ...studentUser,
    userId: "22222222-2222-2222-2222-222222222222",
    role: "moderator",
  };

  it("ensures public user profile NEVER exposes collegeId, email, or internal UUID", () => {
    const sanitized = sanitizeUserProfile(studentUser);

    expect(sanitized.anonymousName).toBe("AnonymousCosmicFox42");
    expect(sanitized.cohort).toBe(2029);
    expect(sanitized.role).toBe("student");

    // Strictly ensure sensitive identifiers are absent from DTO
    expect((sanitized as any).collegeId).toBeUndefined();
    expect((sanitized as any).collegeEmail).toBeUndefined();
    expect((sanitized as any).rollNumber).toBeUndefined();
    expect((sanitized as any).userId).toBeUndefined();
    expect((sanitized as any).id).toBeUndefined();
  });

  it("strictly prevents students from accessing other cohort rooms", () => {
    const myCohortRoom = { type: "cohort" as const, cohortId: "cohort-uuid-2029" };
    const foreignCohortRoom = { type: "cohort" as const, cohortId: "cohort-uuid-2028" };

    expect(canAccessRoom(studentUser, myCohortRoom)).toBe(true);
    expect(canAccessRoom(studentUser, foreignCohortRoom)).toBe(false);
  });

  it("strictly prevents regular students from creating announcements", () => {
    expect(canManageAnnouncements(studentUser.role)).toBe(false);
  });

  it("strictly blocks students and moderators from resolving anonymous identities", () => {
    expect(canResolveIdentity(studentUser.role)).toBe(false);
    expect(canResolveIdentity(moderatorUser.role)).toBe(false);
  });

  it("strictly blocks banned or muted users from sending messages", () => {
    const myCohortRoom = { type: "cohort" as const, cohortId: "cohort-uuid-2029" };

    const mutedStudent = { ...studentUser, isMutedOrBanned: true };
    expect(canWriteInRoom(mutedStudent, myCohortRoom)).toBe(false);

    const bannedStudent = { ...studentUser, status: "banned" as const };
    expect(canWriteInRoom(bannedStudent, myCohortRoom)).toBe(false);
  });
});
