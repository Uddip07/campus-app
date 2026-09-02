import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { canModerate } from "@/lib/auth/rbac";
import { db, schema } from "@/db";
import { eq, desc } from "drizzle-orm";
import { ReportDTO } from "@/lib/types";

export async function GET() {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!canModerate(user.role)) {
      return NextResponse.json(
        { error: "You are not authorized to view reports." },
        { status: 403 }
      );
    }

    // Query pending reports from PostgreSQL
    const rawReports = await db.query.reports.findMany({
      where: eq(schema.reports.status, "pending"),
      orderBy: [desc(schema.reports.createdAt)],
      with: {
        message: {
          with: {
            sender: {
              with: {
                anonymousIdentities: {
                  orderBy: (identities, { desc }) => [desc(identities.createdAt)],
                  limit: 1,
                },
              },
            },
          },
        },
        reporter: {
          with: {
            anonymousIdentities: {
              orderBy: (identities, { desc }) => [desc(identities.createdAt)],
              limit: 1,
            },
          },
        },
      },
    });

    const reportsList: ReportDTO[] = rawReports.map((r) => {
      const msgSenderIdentity = r.message?.sender?.anonymousIdentities[0];
      const reporterIdentity = r.reporter?.anonymousIdentities[0];

      return {
        id: r.id,
        messageId: r.messageId,
        messageContent: r.message?.content || "[Message deleted]",
        messageSenderAnonymousName: msgSenderIdentity?.displayName || "AnonymousUser",
        reporterAnonymousName: reporterIdentity?.displayName || "AnonymousUser",
        reason: r.reason,
        description: r.description,
        status: r.status,
        createdAt: r.createdAt.toISOString(),
        resolvedAt: r.resolvedAt ? r.resolvedAt.toISOString() : null,
      };
    });

    return NextResponse.json({ reports: reportsList });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Error fetching reports";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
