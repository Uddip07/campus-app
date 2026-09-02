import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { canModerate } from "@/lib/auth/rbac";
import { db, schema } from "@/db";
import { eq, count } from "drizzle-orm";
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

    // Query real counts from PostgreSQL
    const [studentCountResult] = await db
      .select({ count: count() })
      .from(schema.users)
      .where(eq(schema.users.role, "student"));

    const [alumniCountResult] = await db
      .select({ count: count() })
      .from(schema.users)
      .where(eq(schema.users.role, "alumni"));

    const [reportCountResult] = await db
      .select({ count: count() })
      .from(schema.reports)
      .where(eq(schema.reports.status, "pending"));

    const [announcementCountResult] = await db
      .select({ count: count() })
      .from(schema.announcements);

    const stats: AdminStatsDTO = {
      totalStudents: Number(studentCountResult?.count ?? 0),
      totalAlumni: Number(alumniCountResult?.count ?? 0),
      pendingReports: Number(reportCountResult?.count ?? 0),
      totalAnnouncements: Number(announcementCountResult?.count ?? 0),
    };

    return NextResponse.json({ stats });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Error fetching stats";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
