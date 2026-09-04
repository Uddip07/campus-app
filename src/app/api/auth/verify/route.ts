import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getVerificationProvider } from "@/lib/verification";
import { generateAnonymousIdentity } from "@/lib/identity/generator";
import { db, schema } from "@/db";
import { eq } from "drizzle-orm";
import { rateLimitAuth } from "@/lib/rate-limit/limiter";
import { isAllowedInstitutionalEmail } from "@/lib/env";

const verifySchema = z.object({
  collegeId: z.string().min(6).max(20),
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

    const authEmail = authUser.email?.trim().toLowerCase();
    // Server-enforced institutional domain check
    if (!authEmail || !isAllowedInstitutionalEmail(authEmail)) {
      return NextResponse.json(
        {
          error: `Access restricted: Only verified @nsut.ac.in institutional email addresses are permitted. Your account email is "${authUser.email || "unknown"}".`,
        },
        { status: 403 }
      );
    }

    // Server-enforced email confirmation check
    const isEmailConfirmed = Boolean(authUser.email_confirmed_at || authUser.confirmed_at);
    if (!isEmailConfirmed) {
      return NextResponse.json(
        {
          error: "Institutional email must be confirmed before student verification. Please check your inbox for the confirmation link.",
        },
        { status: 403 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const parseResult = verifySchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        { error: "Invalid student ID input. Format must match an NSUT College ID (e.g. 2025UIT3090).", details: parseResult.error.format() },
        { status: 400 }
      );
    }

    const { collegeId } = parseResult.data;

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
      collegeEmail: authEmail,
    });

    if (!verified.valid) {
      return NextResponse.json(
        { error: "Student verification failed." },
        { status: 400 }
      );
    }

    // Execute onboarding within an atomic database transaction
    const { userRecord, cohort, activeIdentity } = await db.transaction(async (tx) => {
      // Check if user already exists
      const existingUser = await tx.query.users.findFirst({
        where: eq(schema.users.id, authUser.id),
      });

      // Ensure cohort exists
      let cohortRecord = await tx.query.cohorts.findFirst({
        where: eq(schema.cohorts.graduationYear, verified.graduationYear),
      });

      if (!cohortRecord) {
        const [newCohort] = await tx
          .insert(schema.cohorts)
          .values({ graduationYear: verified.graduationYear })
          .onConflictDoNothing()
          .returning();

        cohortRecord =
          newCohort ||
          (await tx.query.cohorts.findFirst({
            where: eq(schema.cohorts.graduationYear, verified.graduationYear),
          }));

        if (cohortRecord) {
          // Create cohort room idempotently
          await tx
            .insert(schema.rooms)
            .values({
              type: "cohort",
              name: `${verified.graduationYear} Batch`,
              cohortId: cohortRecord.id,
            })
            .onConflictDoNothing();
        }
      }

      if (!cohortRecord) {
        throw new Error("Failed to assign or locate graduation cohort.");
      }

      // Preserve existing elevated roles (super_admin, admin, moderator) if account already exists
      const roleToAssign =
        existingUser?.role && ["moderator", "admin", "super_admin"].includes(existingUser.role)
          ? existingUser.role
          : verified.status === "graduated"
          ? "alumni"
          : "student";

      // Upsert user idempotently
      const [savedUser] = await tx
        .insert(schema.users)
        .values({
          id: authUser.id,
          collegeId: verified.collegeId,
          collegeEmail: verified.collegeEmail,
          enrollmentYear: verified.enrollmentYear,
          programCode: verified.programCode,
          rollNumber: verified.rollNumber,
          cohortId: cohortRecord.id,
          role: roleToAssign,
          status: "active",
        })
        .onConflictDoUpdate({
          target: schema.users.id,
          set: {
            cohortId: cohortRecord.id,
            status: "active",
            updatedAt: new Date(),
          },
        })
        .returning();

      // Check if anonymous identity already exists for this user
      let identity = await tx.query.anonymousIdentities.findFirst({
        where: eq(schema.anonymousIdentities.userId, savedUser.id),
      });

      if (!identity) {
        let created = false;
        let attempts = 0;
        while (!created && attempts < 5) {
          attempts++;
          const candidate = generateAnonymousIdentity();
          try {
            const [newIdent] = await tx
              .insert(schema.anonymousIdentities)
              .values({
                userId: savedUser.id,
                displayName: candidate.displayName,
                avatarSeed: candidate.avatarSeed,
              })
              .onConflictDoNothing()
              .returning();

            if (newIdent) {
              identity = newIdent;
              created = true;
            } else {
              // In case a concurrent request already created an identity
              const found = await tx.query.anonymousIdentities.findFirst({
                where: eq(schema.anonymousIdentities.userId, savedUser.id),
              });
              if (found) {
                identity = found;
                created = true;
              }
            }
          } catch {
            // Retry on collision
          }
        }

        if (!identity) {
          throw new Error("Failed to generate unique anonymous identity.");
        }
      }

      return { userRecord: savedUser, cohort: cohortRecord, activeIdentity: identity };
    });

    return NextResponse.json({
      success: true,
      verificationState: "Verified NSUT institutional email",
      isOfficiallyVerified: verified.isOfficiallyVerified,
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
