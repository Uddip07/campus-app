import { describe, it, expect, beforeEach } from "vitest";
import {
  setVerificationProviderForTesting,
  getVerificationProvider,
  StudentVerificationProvider,
  VerifiedStudent,
  VerifyStudentInput,
} from "@/lib/verification";
import { parseCollegeId } from "@/lib/auth/college-id-parser";
import { generateAnonymousIdentity } from "@/lib/identity/generator";

class TestFixtureVerificationProvider implements StudentVerificationProvider {
  name = "Automated Test Harness Provider";

  isConfigured(): boolean {
    return true;
  }

  async verifyStudent(input: VerifyStudentInput): Promise<VerifiedStudent> {
    const parsed = parseCollegeId(input.collegeId);
    return {
      valid: true,
      collegeId: parsed.raw,
      collegeEmail: input.collegeEmail || `${parsed.raw.toLowerCase()}@nsut.ac.in`,
      enrollmentYear: parsed.enrollmentYear,
      programCode: parsed.programCode,
      rollNumber: parsed.rollNumber,
      graduationYear: parsed.graduationYear,
      status: "active",
    };
  }
}

describe("Student Verification & Anonymous Identity Issuance Flow", () => {
  beforeEach(() => {
    setVerificationProviderForTesting(new TestFixtureVerificationProvider());
  });

  it("completes student verification boundary and issues anonymous identity", async () => {
    const provider = getVerificationProvider();
    const verified = await provider.verifyStudent({
      collegeId: "2025UIT3090",
      collegeEmail: "2025uit3090@nsut.ac.in",
    });

    expect(verified.valid).toBe(true);
    expect(verified.collegeId).toBe("2025UIT3090");
    expect(verified.graduationYear).toBe(2029);

    const identity = generateAnonymousIdentity();
    expect(identity.displayName).toMatch(/^Anonymous/);
    expect(identity.avatarSeed).toBeDefined();
  });
});
