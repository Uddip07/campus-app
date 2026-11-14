import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { canViewAuditLogs } from "@/lib/auth/rbac";
import { connectToDatabase } from "@/db/mongodb";
import { AuditLog, AnonymousIdentity } from "@/db/models";
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

    await connectToDatabase();

    const rawLogs = await AuditLog.find()
      .sort({ createdAt: -1 })
      .limit(100)
      .populate<{ actorId: any }>("actorId")
      .lean();

    const actorObjectIds = rawLogs
      .filter((l) => l.actorId?._id)
      .map((l) => l.actorId._id);

    const identities = await AnonymousIdentity.find({
      userId: { $in: actorObjectIds },
      isActive: true,
    })
      .sort({ createdAt: -1 })
      .lean();

    const identityMap = new Map<string, string>();
    for (const ident of identities) {
      const uId = ident.userId.toString();
      if (!identityMap.has(uId)) {
        identityMap.set(uId, ident.displayName);
      }
    }

    const dtoList: AuditLogDTO[] = rawLogs.map((log) => {
      const actorIdStr = log.actorId?._id ? log.actorId._id.toString() : "";
      return {
        id: log._id.toString(),
        actorAnonymousName: identityMap.get(actorIdStr) || "System/Staff",
        action: log.action,
        targetType: log.targetType,
        targetId: log.targetId || null,
        metadata: (log.metadata as Record<string, unknown>) || {},
        createdAt: new Date(log.createdAt).toISOString(),
      };
    });

    return NextResponse.json({ logs: dtoList });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Error fetching audit logs";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
