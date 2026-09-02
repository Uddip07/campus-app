import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { canViewAuditLogs } from "@/lib/auth/rbac";
import { db, schema } from "@/db";
import { desc } from "drizzle-orm";
import { AuditLogDTO } from "@/lib/types";

export async function GET() {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!canViewAuditLogs(user.role)) {
      return NextResponse.json(
        { error: "Forbidden: Only SUPER_ADMIN can view audit logs." },
        { status: 403 }
      );
    }

    const rawLogs = await db.query.auditLogs.findMany({
      orderBy: [desc(schema.auditLogs.createdAt)],
      limit: 100,
      with: {
        actor: {
          with: {
            anonymousIdentities: {
              limit: 1,
            },
          },
        },
      },
    });

    const dtoList: AuditLogDTO[] = rawLogs.map((log) => ({
      id: log.id,
      actorAnonymousName:
        log.actor?.anonymousIdentities[0]?.displayName || "System/Unknown",
      action: log.action,
      targetType: log.targetType,
      targetId: log.targetId,
      metadata: (log.metadata as Record<string, unknown>) || {},
      createdAt: log.createdAt.toISOString(),
    }));

    return NextResponse.json({ logs: dtoList });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Error fetching audit logs";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
