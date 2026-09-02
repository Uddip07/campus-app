import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUser } from "@/lib/auth/session";
import { canResolveIdentity } from "@/lib/auth/rbac";
import { logAuditEvent } from "@/lib/audit/logger";
import { db, schema } from "@/db";
import { eq, or } from "drizzle-orm";

const resolveSchema = z
  .object({
    anonymousIdentityId: z.string().uuid().optional(),
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

    // Search identity record
    const condition = anonymousIdentityId
      ? eq(schema.anonymousIdentities.id, anonymousIdentityId)
      : eq(schema.anonymousIdentities.displayName, displayName!);

    const identity = await db.query.anonymousIdentities.findFirst({
      where: condition,
      with: {
        user: {
          with: {
            cohort: true,
          },
        },
      },
    });

    if (!identity || !identity.user) {
      return NextResponse.json(
        { error: "Anonymous identity not found." },
        { status: 404 }
      );
    }

    const resolvedUser = identity.user;

    // Mandatory immutable audit log
    await logAuditEvent({
      actorId: user.userId,
      action: "IDENTITY_RESOLUTION",
      targetType: "anonymous_identity",
      targetId: identity.id,
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
        graduationYear: resolvedUser.cohort?.graduationYear ?? null,
        role: resolvedUser.role,
        status: resolvedUser.status,
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Error resolving identity";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
