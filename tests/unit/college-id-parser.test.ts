import { describe, it, expect } from "vitest";
import { parseCollegeId, NSUT_PROGRAM_MAP } from "@/lib/auth/college-id-parser";

describe("NSUT College ID Parser and Cohort Calculation", () => {
  it("correctly parses a standard B.Tech student ID and calculates graduation cohort", () => {
    const parsed = parseCollegeId("2025UIT3090");
    expect(parsed.enrollmentYear).toBe(2025);
    expect(parsed.programCode).toBe("UIT");
    expect(parsed.rollNumber).toBe("3090");
    expect(parsed.programDurationYears).toBe(4);
    expect(parsed.graduationYear).toBe(2029); // 2025 + 4
    expect(parsed.degree).toBe("B.Tech");
  });

  it("correctly parses other B.Tech branches (COE, CSE, CSDA, ECE, ME, BT)", () => {
    const coe = parseCollegeId("2024COE1020");
    expect(coe.enrollmentYear).toBe(2024);
    expect(coe.programCode).toBe("COE");
    expect(coe.graduationYear).toBe(2028);

    const csda = parseCollegeId("2023CSDA110");
    expect(csda.enrollmentYear).toBe(2023);
    expect(csda.programCode).toBe("CSDA");
    expect(csda.graduationYear).toBe(2027);

    const bt = parseCollegeId("2022BT1015");
    expect(bt.enrollmentYear).toBe(2022);
    expect(bt.programCode).toBe("BT");
    expect(bt.graduationYear).toBe(2026);
  });

  it("correctly calculates 2-year duration for M.Tech programs", () => {
    const mtech = parseCollegeId("2025MTECH101");
    expect(mtech.enrollmentYear).toBe(2025);
    expect(mtech.programDurationYears).toBe(2);
    expect(mtech.graduationYear).toBe(2027); // 2025 + 2
    expect(mtech.degree).toBe("M.Tech");
  });

  it("correctly calculates 2-year duration for MBA programs", () => {
    const mba = parseCollegeId("2024MBA205");
    expect(mba.enrollmentYear).toBe(2024);
    expect(mba.programDurationYears).toBe(2);
    expect(mba.graduationYear).toBe(2026);
    expect(mba.degree).toBe("MBA");
  });

  it("correctly calculates 3-year duration for BBA programs", () => {
    const bba = parseCollegeId("2023BBA305");
    expect(bba.enrollmentYear).toBe(2023);
    expect(bba.programDurationYears).toBe(3);
    expect(bba.graduationYear).toBe(2026);
  });

  it("correctly calculates 5-year duration for Ph.D programs", () => {
    const phd = parseCollegeId("2022PHD12");
    expect(phd.enrollmentYear).toBe(2022);
    expect(phd.programDurationYears).toBe(5);
    expect(phd.graduationYear).toBe(2027);
  });

  it("handles lowercase inputs by normalizing to uppercase", () => {
    const lower = parseCollegeId("2025uit3090");
    expect(lower.raw).toBe("2025UIT3090");
    expect(lower.programCode).toBe("UIT");
  });

  it("rejects malformed format strings", () => {
    expect(() => parseCollegeId("INVALID_ID")).toThrowError(/Invalid NSUT College ID format/);
    expect(() => parseCollegeId("2025")).toThrowError(/Invalid NSUT College ID format/);
    expect(() => parseCollegeId("2025UIT")).toThrowError(/Invalid NSUT College ID format/);
    expect(() => parseCollegeId("UIT3090")).toThrowError(/Invalid NSUT College ID format/);
  });

  it("rejects out of range enrollment years", () => {
    expect(() => parseCollegeId("1995UIT3090")).toThrowError(/out of valid range/);
    expect(() => parseCollegeId("2105UIT3090")).toThrowError(/out of valid range/);
  });

  it("rejects unrecognized program codes", () => {
    expect(() => parseCollegeId("2025XYZ3090")).toThrowError(
      /Unsupported or unrecognized NSUT program code/
    );
  });

  it("rejects empty or null input", () => {
    expect(() => parseCollegeId("")).toThrowError(/College ID is required/);
    expect(() => parseCollegeId(null as any)).toThrowError(/College ID is required/);
  });
});
