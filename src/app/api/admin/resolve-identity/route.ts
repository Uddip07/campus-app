import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUser } from "@/lib/auth/session";
import { canResolveIdentity } from "@/lib/auth/rbac";
import { logAuditEvent } from "@/lib/audit/logger";
import { connectToDatabase } from "@/db/mongodb";
import { AnonymousIdentity, User, Cohort } from "@/db/models";
import mongoose from "mongoose";

const resolveSchema = z
  .object({
    anonymousIdentityId: z.string().optional(),
    displayName: z.string().trim().min(3).optional(),
    reason: z
      .string()
      .trim()
      .min(10, "A detailed legitimate reason of at least 10 characters is mandatory for identity resolution."),
  })
  .refine(
    (data) => Boolean(data.anonymousIdentityId || data.displayName),
    {
      message: "Either anonymousIdentityId or displayName must be provided.",
      path: ["displayName"],
    }
  );

export async function POST(req: NextRequest) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Strictly restricted to SUPER_ADMIN
    if (!canResolveIdentity(user.role)) {
      return NextResponse.json(
        {
          error:
            "Forbidden: Identity resolution is strictly restricted to SUPER_ADMIN with legitimate justification.",
        },
        { status: 403 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const parseResult = resolveSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        { error: "Invalid resolution request", details: parseResult.error.format() },
        { status: 400 }
      );
    }

    const { anonymousIdentityId, displayName, reason } = parseResult.data;

    await connectToDatabase();

    // Query identity record in MongoDB
    const query =
      anonymousIdentityId && mongoose.Types.ObjectId.isValid(anonymousIdentityId)
        ? { _id: anonymousIdentityId }
        : { displayName: displayName! };

    const identity = await AnonymousIdentity.findOne(query).populate<{
      userId: any;
    }>({
      path: "userId",
      populate: { path: "cohortId" },
    });

    if (!identity || !identity.userId) {
      return NextResponse.json(
        { error: "Anonymous identity not found." },
        { status: 404 }
      );
    }

    const resolvedUser = identity.userId as any;
    const cohortData = resolvedUser.cohortId as any;

    // Mandatory immutable audit log in MongoDB
    await logAuditEvent({
      actorId: user.userId,
      action: "IDENTITY_RESOLUTION",
      targetType: "anonymous_identity",
      targetId: identity._id.toString(),
      metadata: {
        reason,
        targetDisplayName: identity.displayName,
        resolvedCollegeId: resolvedUser.collegeId,
        resolvedEmail: resolvedUser.collegeEmail,
        resolvedRollNumber: resolvedUser.rollNumber,
      },
    });

    return NextResponse.json({
      success: true,
      resolved: {
        anonymousName: identity.displayName,
        collegeId: resolvedUser.collegeId,
        collegeEmail: resolvedUser.collegeEmail,
        rollNumber: resolvedUser.rollNumber,
        enrollmentYear: resolvedUser.enrollmentYear,
        programCode: resolvedUser.programCode,
        graduationYear: cohortData?.graduationYear ?? null,
        role: resolvedUser.role,
        status: resolvedUser.status,
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Error resolving identity";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
