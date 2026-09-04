// Student Verification Abstraction Interface

export interface VerifyStudentInput {
  collegeId: string;
  collegeEmail?: string;
  verificationToken?: string;
}

export interface VerifiedStudent {
  valid: boolean;
  collegeId: string;
  collegeEmail: string;
  enrollmentYear: number;
  programCode: string;
  rollNumber: string;
  graduationYear: number;
  status: "active" | "graduated";
  verificationMethod: "institutional_email" | "official_nsut_api";
  isOfficiallyVerified: boolean;
}

export interface StudentVerificationProvider {
  name: string;
  isConfigured(): boolean;
  verifyStudent(input: VerifyStudentInput): Promise<VerifiedStudent>;
}
