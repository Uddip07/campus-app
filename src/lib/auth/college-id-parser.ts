// NSUT College ID Parser and Validator

export interface ProgramMetadata {
  name: string;
  degree: "B.Tech" | "M.Tech" | "MBA" | "BBA" | "B.Des" | "Ph.D";
  durationYears: number;
}

// Officially supported NSUT program codes and their durations
export const NSUT_PROGRAM_MAP: Record<string, ProgramMetadata> = {
  // B.Tech (4 Years)
  COE: { name: "Computer Engineering", degree: "B.Tech", durationYears: 4 },
  CSE: { name: "Computer Science and Engineering", degree: "B.Tech", durationYears: 4 },
  CSDA: { name: "CS (Data Analytics)", degree: "B.Tech", durationYears: 4 },
  CSAI: { name: "CS (Artificial Intelligence)", degree: "B.Tech", durationYears: 4 },
  MAC: { name: "Mathematics and Computing", degree: "B.Tech", durationYears: 4 },
  IT: { name: "Information Technology", degree: "B.Tech", durationYears: 4 },
  UIT: { name: "Information Technology (Netaji Subhas)", degree: "B.Tech", durationYears: 4 },
  ECE: { name: "Electronics & Communication Engineering", degree: "B.Tech", durationYears: 4 },
  ECAM: { name: "ECE (Artificial Intelligence & ML)", degree: "B.Tech", durationYears: 4 },
  EE: { name: "Electrical Engineering", degree: "B.Tech", durationYears: 4 },
  ICE: { name: "Instrumentation & Control Engineering", degree: "B.Tech", durationYears: 4 },
  ME: { name: "Mechanical Engineering", degree: "B.Tech", durationYears: 4 },
  MPAE: { name: "Manufacturing Processes & Automation", degree: "B.Tech", durationYears: 4 },
  BT: { name: "Biotechnology", degree: "B.Tech", durationYears: 4 },
  CE: { name: "Civil Engineering", degree: "B.Tech", durationYears: 4 },
  GI: { name: "Geoinformatics", degree: "B.Tech", durationYears: 4 },
  DES: { name: "Design", degree: "B.Des", durationYears: 4 },

  // Post-Graduate (2 Years)
  MTECH: { name: "Master of Technology", degree: "M.Tech", durationYears: 2 },
  VLSI: { name: "VLSI Design", degree: "M.Tech", durationYears: 2 },
  IS: { name: "Information Security", degree: "M.Tech", durationYears: 2 },
  MBA: { name: "Master of Business Administration", degree: "MBA", durationYears: 2 },

  // Undergraduate Management (3 Years)
  BBA: { name: "Bachelor of Business Administration", degree: "BBA", durationYears: 3 },

  // Doctoral (5 Years)
  PHD: { name: "Doctor of Philosophy", degree: "Ph.D", durationYears: 5 },

  // General / Institutional (4 Years default)
  GEN: { name: "General / Institutional", degree: "B.Tech", durationYears: 4 },
};

export interface ParsedCollegeId {
  raw: string;
  enrollmentYear: number;
  programCode: string;
  rollNumber: string;
  degree: string;
  programDurationYears: number;
  graduationYear: number;
}

/**
 * Parses and validates an NSUT Student College ID (e.g. 2025UIT3090, 2024COE1020).
 * Throws explicit descriptive errors on invalid structure or unrecognized programs.
 */
export function parseCollegeId(rawId: string): ParsedCollegeId {
  if (!rawId || typeof rawId !== "string") {
    throw new Error("College ID is required and must be a valid string.");
  }

  const normalized = rawId.trim().toUpperCase();

  // Pattern: 4 digit enrollment year + 2-5 letter program code + 2-6 digit roll number
  const regex = /^(\d{4})([A-Z]{2,5})(\d{2,6})$/;
  const match = normalized.match(regex);

  if (!match) {
    throw new Error(
      `Invalid NSUT College ID format: "${rawId}". Expected format like 2025UIT3090 or 2024COE1020.`
    );
  }

  const [, yearStr, programCode, rollNumber] = match;
  const enrollmentYear = parseInt(yearStr, 10);

  if (enrollmentYear < 2000 || enrollmentYear > 2100) {
    throw new Error(
      `Enrollment year ${enrollmentYear} is out of valid range (2000-2100).`
    );
  }

  const program = NSUT_PROGRAM_MAP[programCode];
  if (!program) {
    throw new Error(
      `Unsupported or unrecognized NSUT program code: "${programCode}".`
    );
  }

  const graduationYear = enrollmentYear + program.durationYears;

  return {
    raw: normalized,
    enrollmentYear,
    programCode,
    rollNumber,
    degree: program.degree,
    programDurationYears: program.durationYears,
    graduationYear,
  };
}
