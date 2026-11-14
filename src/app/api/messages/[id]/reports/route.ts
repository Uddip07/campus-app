import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUser } from "@/lib/auth/session";
import { rateLimitReport } from "@/lib/rate-limit/limiter";
import { connectToDatabase } from "@/db/mongodb";
import { Message, Report } from "@/db/models";
import mongoose from "mongoose";

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
    if (!mongoose.Types.ObjectId.isValid(messageId)) {
      return NextResponse.json({ error: "Message not found" }, { status: 404 });
    }

    const body = await req.json().catch(() => ({}));
    const parseResult = reportSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        { error: "Invalid report reason or format", details: parseResult.error.format() },
        { status: 400 }
      );
    }

    const { reason, description } = parseResult.data;

    await connectToDatabase();

    // Check message exists
    const message = await Message.findById(messageId);
    if (!message) {
      return NextResponse.json({ error: "Message not found" }, { status: 404 });
    }

    const messageObjectId = new mongoose.Types.ObjectId(messageId);
    const reporterObjectId = new mongoose.Types.ObjectId(user.userId);

    // Check if user already reported this message
    const existing = await Report.findOne({
      messageId: messageObjectId,
      reporterId: reporterObjectId,
    });

    if (existing) {
      return NextResponse.json(
        { error: "You have already reported this message." },
        { status: 409 }
      );
    }

    const newReport = await Report.create({
      messageId: messageObjectId,
      reporterId: reporterObjectId,
      reason,
      description: description || null,
      status: "pending",
    });

    return NextResponse.json(
      { success: true, reportId: newReport._id.toString() },
      { status: 201 }
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Report submission error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
