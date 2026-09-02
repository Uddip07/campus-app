import { describe, it, expect } from "vitest";
import { UserRole } from "@/lib/types";

interface AnnouncementRecord {
  id: string;
  audienceType: "all" | "cohort" | "alumni";
  cohortId: string | null;
}

function isAnnouncementVisibleToUser(
  announcement: AnnouncementRecord,
  user: { role: UserRole; cohortId: string }
): boolean {
  if (["admin", "super_admin", "moderator"].includes(user.role)) {
    return true;
  }

  if (announcement.audienceType === "all") {
    return true;
  }

  if (announcement.audienceType === "cohort") {
    return Boolean(announcement.cohortId && announcement.cohortId === user.cohortId);
  }

  if (announcement.audienceType === "alumni") {
    return user.role === "alumni";
  }

  return false;
}

describe("Announcement Audience Visibility Rules", () => {
  const studentCohort2029 = { role: "student" as const, cohortId: "cohort-2029" };
  const studentCohort2028 = { role: "student" as const, cohortId: "cohort-2028" };
  const alumni = { role: "alumni" as const, cohortId: "cohort-2024" };
  const admin = { role: "admin" as const, cohortId: "cohort-2025" };

  const allCollegeAnn: AnnouncementRecord = {
    id: "ann-1",
    audienceType: "all",
    cohortId: null,
  };

  const cohort2029Ann: AnnouncementRecord = {
    id: "ann-2",
    audienceType: "cohort",
    cohortId: "cohort-2029",
  };

  const alumniAnn: AnnouncementRecord = {
    id: "ann-3",
    audienceType: "alumni",
    cohortId: null,
  };

  it("makes 'all' announcements visible to everyone", () => {
    expect(isAnnouncementVisibleToUser(allCollegeAnn, studentCohort2029)).toBe(true);
    expect(isAnnouncementVisibleToUser(allCollegeAnn, studentCohort2028)).toBe(true);
    expect(isAnnouncementVisibleToUser(allCollegeAnn, alumni)).toBe(true);
  });

  it("makes cohort-specific announcements visible ONLY to members of that cohort", () => {
    expect(isAnnouncementVisibleToUser(cohort2029Ann, studentCohort2029)).toBe(true);
    expect(isAnnouncementVisibleToUser(cohort2029Ann, studentCohort2028)).toBe(false);
    expect(isAnnouncementVisibleToUser(cohort2029Ann, alumni)).toBe(false);
  });

  it("makes alumni announcements visible to alumni and hidden from current students", () => {
    expect(isAnnouncementVisibleToUser(alumniAnn, alumni)).toBe(true);
    expect(isAnnouncementVisibleToUser(alumniAnn, studentCohort2029)).toBe(false);
    expect(isAnnouncementVisibleToUser(alumniAnn, studentCohort2028)).toBe(false);
  });

  it("allows administrators to oversee all announcements regardless of audience", () => {
    expect(isAnnouncementVisibleToUser(allCollegeAnn, admin)).toBe(true);
    expect(isAnnouncementVisibleToUser(cohort2029Ann, admin)).toBe(true);
    expect(isAnnouncementVisibleToUser(alumniAnn, admin)).toBe(true);
  });
});
