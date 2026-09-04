import { parseCollegeId } from "../auth/college-id-parser";
import { StudentVerificationProvider, VerifiedStudent, VerifyStudentInput } from "./types";
import { isAllowedInstitutionalEmail } from "../env";

export class InstitutionalEmailProvider implements StudentVerificationProvider {
  name = "NSUT Institutional Email Domain Verification";

  isConfigured(): boolean {
    return true;
  }

  async verifyStudent(input: VerifyStudentInput): Promise<VerifiedStudent> {
    if (!input.collegeEmail) {
      throw new Error("Institutional email is required for verification.");
    }

    const normalizedEmail = input.collegeEmail.trim().toLowerCase();

    if (!isAllowedInstitutionalEmail(normalizedEmail)) {
      throw new Error(
        `Invalid email domain. Institutional verification requires an @nsut.ac.in email address, received: "${input.collegeEmail}".`
      );
    }

    // Parse and validate the Student ID structure to establish cohort & program
    const parsed = parseCollegeId(input.collegeId);

    // Determine account lifecycle from calendar year and program duration.
    // We do not claim official independent verification of the student ID itself.
    const now = new Date();
    const currentYear = now.getFullYear();
    const isGraduated = currentYear >= parsed.graduationYear;

    return {
      valid: true,
      collegeId: parsed.raw,
      collegeEmail: normalizedEmail,
      enrollmentYear: parsed.enrollmentYear,
      programCode: parsed.programCode,
      rollNumber: parsed.rollNumber,
      graduationYear: parsed.graduationYear,
      status: isGraduated ? "graduated" : "active",
      verificationMethod: "institutional_email",
      isOfficiallyVerified: false,
    };
  }
}
