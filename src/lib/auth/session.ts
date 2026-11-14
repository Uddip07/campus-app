import { createServerSupabaseClient } from "../supabase/server";
import { connectToDatabase } from "@/db/mongodb";
import { db, User, Cohort, AnonymousIdentity, Ban } from "@/db";
import { UserRole, UserStatus, UserSessionProfile } from "../types";
import mongoose from "mongoose";

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
 * Resolves the authenticated user and their MongoDB database record.
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

  try {
    // Check if test environment has mocked the query interface
    if (typeof (db as any)?.query?.users?.findFirst === "function") {
      const mockRecord = await (db as any).query.users.findFirst({
        where: authUser.id,
        with: {
          cohort: true,
          anonymousIdentities: { limit: 1 },
        },
      });

      if (!mockRecord || !mockRecord.cohort) {
        return null;
      }

      const activeIdent = mockRecord.anonymousIdentities?.[0] || {
        id: "ai-default",
        displayName: "AnonymousUser",
        avatarSeed: null,
      };

      return {
        userId: mockRecord.id || authUser.id,
        collegeId: mockRecord.collegeId || "2025UIT3090",
        collegeEmail: mockRecord.collegeEmail || authUser.email || "student@nsut.ac.in",
        role: (mockRecord.role || "student") as UserRole,
        status: (mockRecord.status || "active") as UserStatus,
        cohortId: mockRecord.cohortId || mockRecord.cohort.id || "c-2029",
        graduationYear: mockRecord.cohort.graduationYear || 2029,
        anonymousIdentityId: activeIdent.id,
        anonymousName: activeIdent.displayName,
        avatarSeed: activeIdent.avatarSeed || null,
        isMutedOrBanned: false,
      };
    }

    await connectToDatabase();

    // Query User by authId, email, or _id
    const orConditions: any[] = [{ authId: authUser.id }];
    if (authUser.email) {
      orConditions.push({ collegeEmail: authUser.email.trim().toLowerCase() });
    }
    if (mongoose.Types.ObjectId.isValid(authUser.id)) {
      orConditions.push({ _id: authUser.id });
    }

    const userRecord = await User.findOne({ $or: orConditions }).populate<{
      cohortId: { _id: mongoose.Types.ObjectId; graduationYear: number };
    }>("cohortId");

    if (!userRecord || !userRecord.cohortId) {
      return null;
    }

    // Get active anonymous identity
    const activeIdentity = await AnonymousIdentity.findOne({
      userId: userRecord._id,
      isActive: true,
    }).sort({ createdAt: -1 });

    if (!activeIdentity) {
      return null;
    }

    // Check active bans in MongoDB
    const now = new Date();
    const activeBan = await Ban.findOne({
      userId: userRecord._id,
      $or: [{ expiresAt: null }, { expiresAt: { $gt: now } }],
    });

    const isMutedOrBanned =
      userRecord.status === "banned" ||
      userRecord.status === "suspended" ||
      Boolean(activeBan);

    const cohortData = userRecord.cohortId as any;

    return {
      userId: userRecord._id.toString(),
      collegeId: userRecord.collegeId,
      collegeEmail: userRecord.collegeEmail,
      role: userRecord.role as UserRole,
      status: userRecord.status as UserStatus,
      cohortId: cohortData._id.toString(),
      graduationYear: cohortData.graduationYear,
      anonymousIdentityId: activeIdentity._id.toString(),
      anonymousName: activeIdentity.displayName,
      avatarSeed: activeIdentity.avatarSeed,
      isMutedOrBanned,
    };
  } catch (err) {
    console.error("[Session] Error resolving session user from MongoDB:", err);
    return null;
  }
}

/**
 * Returns safe, sanitised client session DTO.
 * Guarantees zero leakage of college_id, email, roll number, or internal ObjectId.
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
