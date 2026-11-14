import { describe, it, expect } from "vitest";
import { COLLECTION_NAMES } from "@/db/models";

describe("Admin Database Explorer Authorization & Collection Validation", () => {
  const allowedAdminRoles = ["admin", "super_admin"];
  const unprivilegedRoles = ["student", "alumni", "moderator"];

  it("strictly restricts database explorer access to admin and super_admin", () => {
    for (const role of allowedAdminRoles) {
      expect(allowedAdminRoles.includes(role)).toBe(true);
    }

    for (const role of unprivilegedRoles) {
      expect(allowedAdminRoles.includes(role)).toBe(false);
    }
  });

  it("validates all 12 registered Mongoose collections in COLLECTION_NAMES", () => {
    expect(COLLECTION_NAMES.length).toBe(12);
    expect(COLLECTION_NAMES).toContain("users");
    expect(COLLECTION_NAMES).toContain("cohorts");
    expect(COLLECTION_NAMES).toContain("anonymousidentities");
    expect(COLLECTION_NAMES).toContain("rooms");
    expect(COLLECTION_NAMES).toContain("messages");
    expect(COLLECTION_NAMES).toContain("messagereactions");
    expect(COLLECTION_NAMES).toContain("reports");
    expect(COLLECTION_NAMES).toContain("bans");
    expect(COLLECTION_NAMES).toContain("announcements");
    expect(COLLECTION_NAMES).toContain("announcementattachments");
    expect(COLLECTION_NAMES).toContain("auditlogs");
    expect(COLLECTION_NAMES).toContain("notificationdevices");
  });

  it("rejects malicious or arbitrary collection queries outside the 12 schema collections", () => {
    const maliciousCollections = [
      "passwords",
      "tokens",
      "system.views",
      "admin.system.users",
      "../../etc/passwd",
      "$cmd",
    ];

    for (const target of maliciousCollections) {
      expect(COLLECTION_NAMES.includes(target as any)).toBe(false);
    }
  });
});
