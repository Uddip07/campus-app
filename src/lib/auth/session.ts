import { createServerSupabaseClient } from "../supabase/server";
import { db, schema } from "@/db";
import { eq, and, gt, or, isNull } from "drizzle-orm";
import { UserRole, UserStatus, UserSessionProfile } from "../types";

export interface FullUserContext {
  userId: string;
  collegeId: string;
  collegeEmail: string;
  role: UserRole;
  status: UserStatus;
  cohortId: string;
  graduationYear: number;
  anonymousIdentityId: string;
  anonymousName: string;
  avatarSeed: string | null;
  isMutedOrBanned: boolean;
}

/**
 * Resolves the authenticated Supabase auth user regardless of whether
 * they have completed internal Campus profile onboarding.
 */
export async function getAuthenticatedAuthUser() {
  const supabase = createServerSupabaseClient();
  if (!supabase) {
    return null;
  }

  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  return authUser;
}

/**
 * Resolves the authenticated Supabase user and their internal database record.
 * Returns null if not logged in or onboarding incomplete.
 */
export async function getSessionUser(): Promise<FullUserContext | null> {
  const supabase = createServerSupabaseClient();
  if (!supabase) {
    return null;
  }

  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  if (!authUser) {
    return null;
  }

  // Look up user by auth UID or email
  const userRecord = await db.query.users.findFirst({
    where: eq(schema.users.id, authUser.id),
    with: {
      cohort: true,
      anonymousIdentities: {
        orderBy: (identities, { desc }) => [desc(identities.createdAt)],
        limit: 1,
      },
    },
  });

  if (!userRecord || !userRecord.cohort) {
    return null;
  }

  const activeIdentity = userRecord.anonymousIdentities[0];
  if (!activeIdentity) {
    return null;
  }

  // Check bans table
  const now = new Date();
  const activeBan = await db.query.bans.findFirst({
    where: and(
      eq(schema.bans.userId, userRecord.id),
      or(isNull(schema.bans.expiresAt), gt(schema.bans.expiresAt, now))
    ),
  });

  const isMutedOrBanned =
    userRecord.status === "banned" ||
    userRecord.status === "suspended" ||
    Boolean(activeBan);

  return {
    userId: userRecord.id,
    collegeId: userRecord.collegeId,
    collegeEmail: userRecord.collegeEmail,
    role: userRecord.role as UserRole,
    status: userRecord.status as UserStatus,
    cohortId: userRecord.cohortId,
    graduationYear: userRecord.cohort.graduationYear,
    anonymousIdentityId: activeIdentity.id,
    anonymousName: activeIdentity.displayName,
    avatarSeed: activeIdentity.avatarSeed,
    isMutedOrBanned,
  };
}

/**
 * Returns safe, sanitised client session DTO.
 * Guarantees zero leakage of college_id, email, roll number, or internal UUID.
 */
export function sanitizeUserProfile(user: FullUserContext): UserSessionProfile {
  return {
    anonymousName: user.anonymousName,
    avatarSeed: user.avatarSeed,
    cohort: user.graduationYear,
    role: user.role,
    status: user.status,
    isMutedOrBanned: user.isMutedOrBanned,
  };
}
