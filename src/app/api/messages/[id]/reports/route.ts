import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUser } from "@/lib/auth/session";
import { rateLimitReport } from "@/lib/rate-limit/limiter";
import { db, schema } from "@/db";
import { and, eq } from "drizzle-orm";

const reportSchema = z.object({
  reason: z.enum([
    "Harassment",
    "Spam",
    "Threat",
    "Hate speech",
    "Impersonation",
    "Other",
  ]),
  description: z.string().max(1000).optional(),
});

interface RouteParams {
  params: {
    id: string;
  };
}

export async function POST(req: NextRequest, { params }: RouteParams) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const rate = await rateLimitReport(user.userId);
    if (!rate.allowed) {
      return NextResponse.json(
        { error: "Too many reports submitted. Please wait before submitting another report." },
        { status: 429 }
      );
    }

    const { id: messageId } = params;
    const body = await req.json().catch(() => ({}));
    const parseResult = reportSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        { error: "Invalid report reason or format", details: parseResult.error.format() },
        { status: 400 }
      );
    }

    const { reason, description } = parseResult.data;

    // Check message exists
    const message = await db.query.messages.findFirst({
      where: eq(schema.messages.id, messageId),
    });

    if (!message) {
      return NextResponse.json({ error: "Message not found" }, { status: 404 });
    }

    // Check if user already reported this message
    const existing = await db.query.reports.findFirst({
      where: and(
        eq(schema.reports.messageId, messageId),
        eq(schema.reports.reporterId, user.userId)
      ),
    });

    if (existing) {
      return NextResponse.json(
        { error: "You have already reported this message." },
        { status: 409 }
      );
    }

    const [newReport] = await db
      .insert(schema.reports)
      .values({
        messageId,
        reporterId: user.userId,
        reason,
        description: description || null,
        status: "pending",
      })
      .returning();

    return NextResponse.json({ success: true, reportId: newReport.id }, { status: 201 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Report submission error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
