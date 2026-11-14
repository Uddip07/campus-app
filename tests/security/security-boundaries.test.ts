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

  it("strictly enforces alumni room boundaries: only alumni and staff may access alumni room", () => {
    const alumniRoom = { type: "alumni" as const, cohortId: null };

    // Undergraduate student cannot access alumni room
    expect(canAccessRoom(studentUser, alumniRoom)).toBe(false);

    // Graduated alumni can access alumni room
    const alumniUser: FullUserContext = {
      ...studentUser,
      userId: "33333333-3333-3333-3333-333333333333",
      role: "alumni",
      graduationYear: 2024,
    };
    expect(canAccessRoom(alumniUser, alumniRoom)).toBe(true);

    // Staff can access alumni room for moderation
    expect(canAccessRoom(moderatorUser, alumniRoom)).toBe(true);
  });

  it("strictly prevents alumni from accessing current undergraduate cohort rooms", () => {
    const activeStudentCohortRoom = { type: "cohort" as const, cohortId: "cohort-uuid-2029" };
    const alumniUser: FullUserContext = {
      ...studentUser,
      userId: "33333333-3333-3333-3333-333333333333",
      role: "alumni",
      cohortId: "cohort-uuid-2024",
      graduationYear: 2024,
    };

    expect(canAccessRoom(alumniUser, activeStudentCohortRoom)).toBe(false);
  });

  it("verifies public message DTO privacy invariant: no PII leakage", () => {
    const rawPublicMessage = {
      id: "6735234567890abcdef12345",
      roomId: "6735234567890abcdef12346",
      content: "Has anyone solved DBMS Assignment 3?",
      replyToId: null,
      replyCount: 0,
      reactions: [{ reaction: "like", count: 2, hasReacted: false }],
      sender: {
        displayName: "AnonymousCosmicFox42",
        avatarSeed: "seed123",
      },
      createdAt: new Date().toISOString(),
      isSender: false,
      moderationStatus: "approved",
    };

    // Public message payload must NEVER contain student PII
    expect((rawPublicMessage as any).sender.collegeId).toBeUndefined();
    expect((rawPublicMessage as any).sender.collegeEmail).toBeUndefined();
    expect((rawPublicMessage as any).sender.rollNumber).toBeUndefined();
    expect((rawPublicMessage as any).sender.userId).toBeUndefined();
    expect((rawPublicMessage as any).sender.authId).toBeUndefined();
    expect(rawPublicMessage.sender.displayName).toMatch(/^Anonymous[A-Z][a-z]+[A-Z][a-z]+\d+$/);
  });
});
