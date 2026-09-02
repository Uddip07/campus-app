import { getNsutVerificationConfig } from "../env";
import { parseCollegeId } from "../auth/college-id-parser";
import { StudentVerificationProvider, VerifiedStudent, VerifyStudentInput } from "./types";

export class ConfiguredNsutProvider implements StudentVerificationProvider {
  name = "NSUT Official Verification Authority";

  isConfigured(): boolean {
    const config = getNsutVerificationConfig();
    return config.isConfigured;
  }

  async verifyStudent(input: VerifyStudentInput): Promise<VerifiedStudent> {
    const config = getNsutVerificationConfig();

    if (!config.isConfigured) {
      throw new Error(
        "NSUT student verification is not configured. External verification authority URL and credentials must be configured."
      );
    }

    // Parse and validate the ID structure first
    const parsed = parseCollegeId(input.collegeId);

    // Call official NSUT verification endpoint
    const response = await fetch(config.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Client-ID": config.clientId,
        "Authorization": `Bearer ${config.clientSecret}`,
      },
      body: JSON.stringify({
        collegeId: parsed.raw,
        collegeEmail: input.collegeEmail,
        verificationToken: input.verificationToken,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`NSUT verification service returned error: ${response.status} ${errorText}`);
    }

    const data = await response.json();
    if (!data.verified) {
      throw new Error("Student identity could not be verified by NSUT verification service.");
    }

    const now = new Date();
    const currentYear = now.getFullYear();
    const isGraduated = currentYear >= parsed.graduationYear;

    return {
      valid: true,
      collegeId: parsed.raw,
      collegeEmail: input.collegeEmail || `${parsed.raw.toLowerCase()}@nsut.ac.in`,
      enrollmentYear: parsed.enrollmentYear,
      programCode: parsed.programCode,
      rollNumber: parsed.rollNumber,
      graduationYear: parsed.graduationYear,
      status: isGraduated ? "graduated" : "active",
    };
  }
}
