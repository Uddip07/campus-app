import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { canModerate } from "@/lib/auth/rbac";
import { connectToDatabase } from "@/db/mongodb";
import { Report, Message, AnonymousIdentity } from "@/db/models";
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

    await connectToDatabase();

    // Query pending reports from MongoDB
    const rawReports = await Report.find({ status: "pending" })
      .sort({ createdAt: -1 })
      .populate<{ messageId: any }>("messageId")
      .populate<{ reporterId: any }>("reporterId")
      .lean();

    // Collect sender IDs and reporter IDs
    const userObjectIds: any[] = [];
    for (const r of rawReports) {
      if (r.messageId?.senderId) {
        userObjectIds.push(r.messageId.senderId);
      }
      if (r.reporterId?._id) {
        userObjectIds.push(r.reporterId._id);
      }
    }

    const identities = await AnonymousIdentity.find({
      userId: { $in: userObjectIds },
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

    const reportsList: ReportDTO[] = rawReports.map((r) => {
      const msg = r.messageId;
      const reporter = r.reporterId;
      const msgSenderUId = msg?.senderId ? msg.senderId.toString() : "";
      const reporterUId = reporter?._id ? reporter._id.toString() : "";

      return {
        id: r._id.toString(),
        messageId: msg?._id ? msg._id.toString() : r.messageId?.toString() || "",
        messageContent: msg?.content || "[Message deleted]",
        messageSenderAnonymousName: identityMap.get(msgSenderUId) || "AnonymousUser",
        reporterAnonymousName: identityMap.get(reporterUId) || "AnonymousUser",
        reason: r.reason,
        description: r.description ?? null,
        status: r.status,
        createdAt: new Date(r.createdAt).toISOString(),
        resolvedAt: r.resolvedAt ? new Date(r.resolvedAt).toISOString() : null,
      };
    });

    return NextResponse.json({ reports: reportsList });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Error fetching reports";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
