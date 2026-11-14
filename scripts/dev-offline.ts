import { MongoMemoryServer } from "mongodb-memory-server";
import { spawn } from "child_process";
import fs from "fs";
import path from "path";

async function runOffline() {
  console.log("--------------------------------------------------");
  console.log("📦 Starting In-Memory MongoDB Server...");
  const mongod = await MongoMemoryServer.create({
    instance: {
      dbName: "campusconnect",
    },
  });

  const uri = mongod.getUri() + "campusconnect";
  process.env.MONGODB_URI = uri;
  process.env.OFFLINE_MODE = "true";

  console.log(`✅ MongoDB Memory Server running at: ${uri}`);

  // Write temporary .env.local for Next.js dev server
  const envLocalPath = path.join(process.cwd(), ".env.local");
  const envContent = `MONGODB_URI=${uri}\nOFFLINE_MODE=true\n`;
  fs.writeFileSync(envLocalPath, envContent, "utf-8");

  console.log("🌱 Seeding MongoDB database with structural & demo records...");
  const { seedDatabase } = await import("../src/db/seed");
  await seedDatabase();
  console.log("✅ Database seeded successfully!");

  console.log("--------------------------------------------------");
  console.log("🚀 Starting Next.js Local Server on Port 3000...");
  console.log("--------------------------------------------------");

  const isWindows = process.platform === "win32";
  const nextCmd = isWindows ? "npx.cmd" : "npx";

  const nextProcess = spawn(nextCmd, ["next", "dev", "-p", "3000"], {
    stdio: "inherit",
    shell: true,
    env: {
      ...process.env,
      MONGODB_URI: uri,
      OFFLINE_MODE: "true",
    },
  });

  console.log("\n==================================================");
  console.log("🎉 CAMPUSCONNECT IS LIVE LOCALLY (OFFLINE MODE)!");
  console.log("🔗 Web App Link:              http://localhost:3000");
  console.log("🗄️ MongoDB Database Explorer: http://localhost:3000/admin/database");
  console.log("💬 All College Chat:          http://localhost:3000/chat/all");
  console.log("🎓 Cohort Batch Chat:         http://localhost:3000/chat/cohort");
  console.log("🏛️ Alumni Chat:               http://localhost:3000/chat/alumni");
  console.log("📢 Campus Announcements:      http://localhost:3000/announcements");
  console.log("🛡️ Admin Moderation Desk:     http://localhost:3000/admin");
  console.log("==================================================\n");

  const cleanup = async () => {
    console.log("\n🛑 Shutting down offline server...");
    nextProcess.kill();
    await mongod.stop();
    if (fs.existsSync(envLocalPath)) {
      try {
        fs.unlinkSync(envLocalPath);
      } catch {}
    }
    process.exit(0);
  };

  process.on("SIGINT", cleanup);
  process.on("SIGTERM", cleanup);
}

runOffline().catch((err) => {
  console.error("❌ Failed to start offline server:", err);
  process.exit(1);
});
