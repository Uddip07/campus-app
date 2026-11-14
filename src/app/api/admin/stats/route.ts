import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { canModerate } from "@/lib/auth/rbac";
import { connectToDatabase } from "@/db/mongodb";
import { User, Report, Announcement } from "@/db/models";
import { AdminStatsDTO } from "@/lib/types";

export async function GET() {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!canModerate(user.role)) {
      return NextResponse.json(
        { error: "You are not authorized to view admin statistics." },
        { status: 403 }
      );
    }

    await connectToDatabase();

    // Query real counts directly from MongoDB Atlas (zero mock data)
    const [totalStudents, totalAlumni, pendingReports, totalAnnouncements] =
      await Promise.all([
        User.countDocuments({ role: "student" }),
        User.countDocuments({ role: "alumni" }),
        Report.countDocuments({ status: "pending" }),
        Announcement.countDocuments(),
      ]);

    const stats: AdminStatsDTO = {
      totalStudents,
      totalAlumni,
      pendingReports,
      totalAnnouncements,
    };

    return NextResponse.json({ stats });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Error fetching stats";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
