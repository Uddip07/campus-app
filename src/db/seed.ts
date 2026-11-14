import { connectToDatabase } from "./mongodb";
import {
  Cohort,
  Room,
  User,
  AnonymousIdentity,
  Announcement,
  Message,
  MessageReaction,
  Report,
  AuditLog,
  ICohort,
} from "./models";

export async function seedDatabase() {
  await connectToDatabase();

  console.log("[Seed] Starting MongoDB database seed...");

  // 1. Seed Cohorts (2024 - 2033 to cover all requested years 2026-2033 plus alumni)
  const cohortYears = [2024, 2025, 2026, 2027, 2028, 2029, 2030, 2031, 2032, 2033];
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

  // 4. Seed Demo Accounts & Sample Records for Live Demonstration
  const existingUsers = await User.countDocuments();
  if (existingUsers === 0) {
    console.log("[Seed] Seeding structured demo users and baseline activity...");

    const cohort2024 = cohortMap.get(2024)!;
    const cohort2026 = cohortMap.get(2026)!;
    const cohort2028 = cohortMap.get(2028)!;

    // Super Admin
    const adminUser = await User.create({
      collegeId: "2022UIT0001",
      collegeEmail: "admin@nsut.ac.in",
      enrollmentYear: 2022,
      programCode: "UIT",
      rollNumber: "0001",
      cohortId: cohort2026._id,
      role: "super_admin",
      status: "active",
    });
    await AnonymousIdentity.create({
      userId: adminUser._id,
      displayName: "StaffGuardian01",
      avatarSeed: "StaffGuardian01",
      isActive: true,
    });

    // Moderator
    const modUser = await User.create({
      collegeId: "2022CS0100",
      collegeEmail: "moderator@nsut.ac.in",
      enrollmentYear: 2022,
      programCode: "CS",
      rollNumber: "0100",
      cohortId: cohort2026._id,
      role: "moderator",
      status: "active",
    });
    await AnonymousIdentity.create({
      userId: modUser._id,
      displayName: "AnonymousWiseOwl17",
      avatarSeed: "AnonymousWiseOwl17",
      isActive: true,
    });

    // Student (Batch 2028)
    const studentUser = await User.create({
      collegeId: "2024UIT1010",
      collegeEmail: "student@nsut.ac.in",
      enrollmentYear: 2024,
      programCode: "UIT",
      rollNumber: "1010",
      cohortId: cohort2028._id,
      role: "student",
      status: "active",
    });
    await AnonymousIdentity.create({
      userId: studentUser._id,
      displayName: "AnonymousCosmicFox42",
      avatarSeed: "AnonymousCosmicFox42",
      isActive: true,
    });

    // Alumni (Batch 2024)
    const alumniUser = await User.create({
      collegeId: "2020ECE0055",
      collegeEmail: "alumni@nsut.ac.in",
      enrollmentYear: 2020,
      programCode: "ECE",
      rollNumber: "0055",
      cohortId: cohort2024._id,
      role: "alumni",
      status: "active",
    });
    await AnonymousIdentity.create({
      userId: alumniUser._id,
      displayName: "AnonymousSilverFalcon88",
      avatarSeed: "AnonymousSilverFalcon88",
      isActive: true,
    });

    // Seed Pinned Announcement
    const announcement1 = await Announcement.create({
      title: "Welcome to CampusConnect — NSUT Anonymous Student Platform",
      content:
        "Welcome to CampusConnect! This platform enables verified, privacy-preserving academic communication across NSUT cohorts, global discussion boards, and alumni channels.",
      authorId: adminUser._id,
      audienceType: "all",
      isPinned: true,
      publishedAt: new Date(),
    });

    // Seed Cohort Specific Announcement
    await Announcement.create({
      title: "DBMS Project Evaluation Schedule — Batch 2028",
      content:
        "All second-year students enrolled in Database Management Systems are requested to ensure their MongoDB repository is deployed and demonstration guides are prepared.",
      authorId: adminUser._id,
      audienceType: "cohort",
      cohortId: cohort2028._id,
      isPinned: false,
      publishedAt: new Date(),
    });

    // Seed Demo Messages in All College Room
    const msg1 = await Message.create({
      roomId: globalRoom._id,
      senderId: studentUser._id,
      content: "Hello NSUT! Has anyone reviewed the DBMS lab syllabus for this semester?",
      moderationStatus: "approved",
      createdAt: new Date(Date.now() - 3600000),
    });

    const msg2 = await Message.create({
      roomId: globalRoom._id,
      senderId: alumniUser._id,
      content: "Alumni here — make sure you understand indexing, compound cursors, and normalization proofs thoroughly!",
      replyToId: msg1._id,
      moderationStatus: "approved",
      createdAt: new Date(Date.now() - 1800000),
    });

    // Seed Demo Reaction
    await MessageReaction.create({
      messageId: msg2._id,
      userId: studentUser._id,
      reaction: "love",
    });

    await MessageReaction.create({
      messageId: msg1._id,
      userId: modUser._id,
      reaction: "like",
    });

    // Seed Demo Flagged Message & Report for Moderator Desk
    const flaggedMsg = await Message.create({
      roomId: globalRoom._id,
      senderId: studentUser._id,
      content: "Sample flagged message for moderator queue verification: spam promotional link.",
      moderationStatus: "approved",
      createdAt: new Date(Date.now() - 600000),
    });

    await Report.create({
      messageId: flaggedMsg._id,
      reporterId: alumniUser._id,
      reason: "Spam",
      description: "Reported as promotional spam for moderator triage verification.",
      status: "pending",
    });

    // Initial Audit Log
    await AuditLog.create({
      actorId: adminUser._id,
      action: "system_bootstrap",
      targetType: "system",
      targetId: "mongodb_init",
      metadata: {
        reason: "Initial system seeding with NSUT cohorts, rooms, and demonstration dataset",
        seededAt: new Date().toISOString(),
      },
    });

    console.log("[Seed] Demo users, announcements, messages, reactions, and reports created successfully.");
  }

  console.log("[Seed] Database seed completed successfully.");
}

// Allow CLI execution: npx tsx src/db/seed.ts
if (require.main === module || (typeof process !== "undefined" && process.argv[1]?.includes("seed"))) {
  seedDatabase()
    .then(() => {
      console.log("[Seed] Process complete.");
      process.exit(0);
    })
    .catch((err) => {
      console.error("[Seed] Error seeding database:", err);
      process.exit(1);
    });
}
