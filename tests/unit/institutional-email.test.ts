import { describe, it, expect } from "vitest";
import { isAllowedInstitutionalEmail } from "@/lib/env";
import { InstitutionalEmailProvider } from "@/lib/verification/email-provider";

describe("Institutional Email Validation & Provider Unit Tests", () => {
  describe("isAllowedInstitutionalEmail() domain enforcement", () => {
    it("accepts valid @nsut.ac.in email addresses regardless of case", () => {
      expect(isAllowedInstitutionalEmail("2025uit3090@nsut.ac.in")).toBe(true);
      expect(isAllowedInstitutionalEmail("student@NSUT.AC.IN")).toBe(true);
      expect(isAllowedInstitutionalEmail("alumni.council@nsut.ac.in")).toBe(true);
      expect(isAllowedInstitutionalEmail("  test@nsut.ac.in  ")).toBe(true);
    });

    it("strictly rejects non-NSUT email addresses", () => {
      expect(isAllowedInstitutionalEmail("student@gmail.com")).toBe(false);
      expect(isAllowedInstitutionalEmail("student@outlook.com")).toBe(false);
      expect(isAllowedInstitutionalEmail("student@dtu.ac.in")).toBe(false);
      expect(isAllowedInstitutionalEmail("student@iitd.ac.in")).toBe(false);
    });

    it("strictly rejects spoofed or subdomain lookalike domains", () => {
      expect(isAllowedInstitutionalEmail("student@nsut.ac.in.attacker.com")).toBe(false);
      expect(isAllowedInstitutionalEmail("student@fake-nsut.ac.in")).toBe(false);
      expect(isAllowedInstitutionalEmail("student@nsut.ac.in@evil.com")).toBe(false);
      expect(isAllowedInstitutionalEmail("nsut.ac.in")).toBe(false);
      expect(isAllowedInstitutionalEmail("")).toBe(false);
      expect(isAllowedInstitutionalEmail(null as any)).toBe(false);
    });
  });

  describe("InstitutionalEmailProvider", () => {
    const provider = new InstitutionalEmailProvider();

    it("is always configured without needing external API credentials", () => {
      expect(provider.isConfigured()).toBe(true);
      expect(provider.name).toBe("NSUT Institutional Email Domain Verification");
    });

    it("verifies a student with valid @nsut.ac.in email and valid college ID", async () => {
      const verified = await provider.verifyStudent({
        collegeId: "2025UIT3090",
        collegeEmail: "2025uit3090@nsut.ac.in",
      });

      expect(verified.valid).toBe(true);
      expect(verified.collegeId).toBe("2025UIT3090");
      expect(verified.collegeEmail).toBe("2025uit3090@nsut.ac.in");
      expect(verified.enrollmentYear).toBe(2025);
      expect(verified.programCode).toBe("UIT");
      expect(verified.rollNumber).toBe("3090");
      expect(verified.graduationYear).toBe(2029);
      expect(verified.status).toBe("active");
      expect(verified.verificationMethod).toBe("institutional_email");
      expect(verified.isOfficiallyVerified).toBe(false);
    });

    it("truthfully marks past cohorts as graduated alumni", async () => {
      const verified = await provider.verifyStudent({
        collegeId: "2018COE1001",
        collegeEmail: "2018coe1001@nsut.ac.in",
      });

      expect(verified.graduationYear).toBe(2022);
      expect(verified.status).toBe("graduated");
      expect(verified.verificationMethod).toBe("institutional_email");
      expect(verified.isOfficiallyVerified).toBe(false);
    });

    it("rejects non-institutional emails during verification", async () => {
      await expect(
        provider.verifyStudent({
          collegeId: "2025UIT3090",
          collegeEmail: "personal@gmail.com",
        })
      ).rejects.toThrow(/Invalid email domain/);
    });

    it("rejects if institutional email is missing", async () => {
      await expect(
        provider.verifyStudent({
          collegeId: "2025UIT3090",
        })
      ).rejects.toThrow(/Institutional email is required/);
    });
  });
});
