import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getVerificationProvider } from "@/lib/verification";
import { generateAnonymousIdentity } from "@/lib/identity/generator";
import { db, schema } from "@/db";
import { eq } from "drizzle-orm";
import { rateLimitAuth } from "@/lib/rate-limit/limiter";

const verifySchema = z.object({
  collegeId: z.string().min(6).max(20),
  collegeEmail: z.string().email().optional(),
  verificationToken: z.string().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const supabase = createServerSupabaseClient();
    if (!supabase) {
      return NextResponse.json(
        { error: "Supabase configuration is missing." },
        { status: 503 }
      );
    }

    const {
      data: { user: authUser },
    } = await supabase.auth.getUser();

    if (!authUser) {
      return NextResponse.json(
        { error: "Authentication required before student verification." },
        { status: 401 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const parseResult = verifySchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        { error: "Invalid verification input.", details: parseResult.error.format() },
        { status: 400 }
      );
    }

    const { collegeId, collegeEmail, verificationToken } = parseResult.data;

    // Rate limit verification attempts
    const rateCheck = await rateLimitAuth(authUser.id);
    if (!rateCheck.allowed) {
      return NextResponse.json(
        { error: "Too many verification attempts. Please try again later." },
        { status: 429 }
      );
    }

    // Call Verification Provider Boundary
    const provider = getVerificationProvider();
    const verified = await provider.verifyStudent({
      collegeId,
      collegeEmail,
      verificationToken,
    });

    if (!verified.valid) {
      return NextResponse.json(
        { error: "Student verification failed." },
        { status: 400 }
      );
    }

    // Ensure cohort exists
    let cohort = await db.query.cohorts.findFirst({
      where: eq(schema.cohorts.graduationYear, verified.graduationYear),
    });

    if (!cohort) {
      const [newCohort] = await db
        .insert(schema.cohorts)
        .values({ graduationYear: verified.graduationYear })
        .returning();
      cohort = newCohort;

      // Create cohort room
      await db.insert(schema.rooms).values({
        type: "cohort",
        name: `${verified.graduationYear} Batch`,
        cohortId: cohort.id,
      });
    }

    // Upsert user
    const [userRecord] = await db
      .insert(schema.users)
      .values({
        id: authUser.id,
        collegeId: verified.collegeId,
        collegeEmail: verified.collegeEmail,
        enrollmentYear: verified.enrollmentYear,
        programCode: verified.programCode,
        rollNumber: verified.rollNumber,
        cohortId: cohort.id,
        role: verified.status === "graduated" ? "alumni" : "student",
        status: "active",
      })
      .onConflictDoUpdate({
        target: schema.users.id,
        set: {
          status: "active",
          updatedAt: new Date(),
        },
      })
      .returning();

    // Check if anonymous identity already exists for this user
    let activeIdentity = await db.query.anonymousIdentities.findFirst({
      where: eq(schema.anonymousIdentities.userId, userRecord.id),
    });

    if (!activeIdentity) {
      // Generate new cryptographically random anonymous identity
      let created = false;
      let attempts = 0;
      while (!created && attempts < 5) {
        attempts++;
        const candidate = generateAnonymousIdentity();
        try {
          const [newIdent] = await db
            .insert(schema.anonymousIdentities)
            .values({
              userId: userRecord.id,
              displayName: candidate.displayName,
              avatarSeed: candidate.avatarSeed,
            })
            .returning();
          activeIdentity = newIdent;
          created = true;
        } catch {
          // Retry on unique collision
        }
      }

      if (!activeIdentity) {
        return NextResponse.json(
          { error: "Failed to generate unique anonymous identity." },
          { status: 500 }
        );
      }
    }

    return NextResponse.json({
      success: true,
      profile: {
        anonymousName: activeIdentity.displayName,
        avatarSeed: activeIdentity.avatarSeed,
        cohort: cohort.graduationYear,
        role: userRecord.role,
        status: userRecord.status,
        isMutedOrBanned: false,
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Verification error";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
