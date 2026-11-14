import { connectToDatabase } from "./mongodb";
import { Cohort, Room, User, AnonymousIdentity, Announcement, ICohort, IRoom } from "./models";

export async function seedDatabase() {
  await connectToDatabase();

  console.log("[Seed] Starting MongoDB database seed...");

  // 1. Seed Cohorts (2024 - 2032)
  const cohortYears = [2024, 2025, 2026, 2027, 2028, 2029, 2030, 2031, 2032];
  const cohortMap = new Map<number, ICohort>();

  for (const year of cohortYears) {
    let cohort = await Cohort.findOne({ graduationYear: year });
    if (!cohort) {
      cohort = await Cohort.create({ graduationYear: year });
      console.log(`[Seed] Created Cohort ${year}`);
    }
    cohortMap.set(year, cohort);
  }

  // 2. Seed Global and Alumni Rooms
  let globalRoom = await Room.findOne({ type: "global" });
  if (!globalRoom) {
    globalRoom = await Room.create({
      type: "global",
      name: "All College",
      cohortId: null,
    });
    console.log("[Seed] Created Global Room 'All College'");
  }

  let alumniRoom = await Room.findOne({ type: "alumni" });
  if (!alumniRoom) {
    alumniRoom = await Room.create({
      type: "alumni",
      name: "Alumni",
      cohortId: null,
    });
    console.log("[Seed] Created Alumni Room 'Alumni'");
  }

  // 3. Seed Cohort Rooms
  for (const [year, cohort] of cohortMap.entries()) {
    let cohortRoom = await Room.findOne({ type: "cohort", cohortId: cohort._id });
    if (!cohortRoom) {
      cohortRoom = await Room.create({
        type: "cohort",
        name: `${year} Batch`,
        cohortId: cohort._id,
      });
      console.log(`[Seed] Created Cohort Room '${year} Batch'`);
    }
  }

  // 4. Seed demo admin user if none exists
  const userCount = await User.countDocuments();
  if (userCount === 0) {
    const adminCohort = cohortMap.get(2026)!;
    const adminUser = await User.create({
      collegeId: "2022UIT0001",
      collegeEmail: "admin@nsut.ac.in",
      enrollmentYear: 2022,
      programCode: "UIT",
      rollNumber: "0001",
      cohortId: adminCohort._id,
      role: "super_admin",
      status: "active",
    });

    await AnonymousIdentity.create({
      userId: adminUser._id,
      displayName: "StaffGuardian01",
      avatarSeed: "StaffGuardian01",
      isActive: true,
    });

    await Announcement.create({
      title: "Welcome to CampusConnect",
      content:
        "Welcome to the official NSUT student and academic collaboration platform. Discuss campus academics, batch updates, and announcements in real-time.",
      authorId: adminUser._id,
      audienceType: "all",
      isPinned: true,
      publishedAt: new Date(),
    });

    console.log("[Seed] Created default super_admin and welcome announcement.");
  }

  console.log("[Seed] Database seed completed successfully.");
}

// Allow CLI execution: tsx src/db/seed.ts
if (require.main === module) {
  seedDatabase()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error("[Seed] Error seeding database:", err);
      process.exit(1);
    });
}
