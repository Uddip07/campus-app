import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";

// Track mock state for Supabase
let currentAuthUser: { id: string; email: string; email_confirmed_at?: string } | null = null;
let dbUserRecord: any = null;
const mockSignInWithOtp = vi.fn();
const mockExchangeCodeForSession = vi.fn();
const mockGetUser = vi.fn();
const mockSignOut = vi.fn();
const mockUpdateUser = vi.fn();

vi.mock("@supabase/ssr", () => ({
  createServerClient: vi.fn((_url, _key, options) => {
    return {
      auth: {
        signInWithOtp: mockSignInWithOtp,
        exchangeCodeForSession: mockExchangeCodeForSession,
        getUser: vi.fn(async () => {
          if (currentAuthUser) {
            // Simulate cookie refresh if setAll provided
            if (options?.cookies?.setAll) {
              options.cookies.setAll([
                {
                  name: "sb-mock-auth-token",
                  value: "refreshed-token-xyz",
                  options: { maxAge: 400 * 24 * 60 * 60, path: "/", sameSite: "lax" },
                },
              ]);
            }
            return { data: { user: currentAuthUser }, error: null };
          }
          return { data: { user: null }, error: null };
        }),
        signOut: mockSignOut,
        updateUser: mockUpdateUser,
      },
    };
  }),
  createBrowserClient: vi.fn(() => ({
    auth: {
      getUser: vi.fn(async () => ({ data: { user: currentAuthUser }, error: null })),
      signOut: mockSignOut,
    },
  })),
}));

vi.mock("@/lib/env", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/env")>();
  return {
    ...actual,
    getSupabaseConfig: () => ({
      url: "https://mock.supabase.co",
      publishableKey: "mock-pub-key",
      secretKey: "mock-secret-key",
      isConfigured: true,
    }),
  };
});

vi.mock("@/db", () => ({
  db: {
    query: {
      users: {
        findFirst: vi.fn(async () => dbUserRecord),
      },
      cohorts: {
        findFirst: vi.fn(async () => ({ id: "c-2029", graduationYear: 2029 })),
      },
      bans: {
        findFirst: vi.fn(async () => null),
      },
      rooms: {
        findFirst: vi.fn(async () => ({ id: "r-global", type: "global", name: "All College" })),
      },
      anonymousIdentities: {
        findFirst: vi.fn(async () => ({ id: "ai-1", displayName: "Anonymous Owl", avatarSeed: "seed" })),
      },
    },
    transaction: vi.fn(async (cb) => {
      const tx = {
        query: {
          users: { findFirst: vi.fn(async () => null) },
          cohorts: { findFirst: vi.fn(async () => ({ id: "c-2029", graduationYear: 2029 })) },
          anonymousIdentities: { findFirst: vi.fn(async () => null) },
        },
        insert: vi.fn(() => ({
          values: vi.fn(() => ({
            onConflictDoNothing: vi.fn(() => ({
              returning: vi.fn(() => [{ id: "c-2029", graduationYear: 2029 }]),
            })),
            onConflictDoUpdate: vi.fn(() => ({
              returning: vi.fn(() => [
                {
                  id: "u-scenario",
                  collegeId: "2025UIT3090",
                  collegeEmail: "2025uit3090@nsut.ac.in",
                  cohortId: "c-2029",
                  role: "student",
                  status: "active",
                },
              ]),
            })),
            returning: vi.fn(() => [
              {
                id: "ai-1",
                displayName: "Anonymous Owl",
                avatarSeed: "seed",
              },
            ]),
          })),
        })),
      };
      return cb(tx);
    }),
  },
  schema: {
    users: { id: "id" },
    cohorts: { id: "id", graduationYear: "graduationYear" },
    rooms: { id: "id", type: "type" },
    bans: { userId: "userId", expiresAt: "expiresAt" },
    anonymousIdentities: { userId: "userId", createdAt: "createdAt" },
  },
}));

vi.mock("@/lib/supabase/server", () => ({
  createServerSupabaseClient: vi.fn(() => ({
    auth: {
      signInWithOtp: mockSignInWithOtp,
      exchangeCodeForSession: mockExchangeCodeForSession,
      getUser: vi.fn(async () => ({ data: { user: currentAuthUser }, error: null })),
      signOut: mockSignOut,
      updateUser: mockUpdateUser,
    },
  })),
}));

// Import routes after mocks are defined
import { POST as loginPOST } from "@/app/api/auth/login/route";
import { GET as callbackGET } from "@/app/auth/callback/route";
import { POST as verifyPOST } from "@/app/api/auth/verify/route";
import { POST as logoutPOST } from "@/app/api/auth/logout/route";
import { middleware } from "@/middleware";
import LoginPage from "@/app/login/page";
import VerifyPage from "@/app/verify/page";
import HomePage from "@/app/page";
import ChatPage from "@/app/chat/page";

describe("Persistent Session Exact 13-Point Test Scenario", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    currentAuthUser = null;
    dbUserRecord = null;
  });

  it("Executes the exact 13-point authentication, persistence, refresh, and routing scenario", async () => {
    // -------------------------------------------------------------------------
    // Step 1: Sign in through email.
    // -------------------------------------------------------------------------
    mockSignInWithOtp.mockResolvedValueOnce({ data: {}, error: null });

    const loginReq = new NextRequest("http://localhost:3000/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email: "2025uit3090@nsut.ac.in" }),
    });
    const loginRes = await loginPOST(loginReq);
    expect(loginRes.status).toBe(200);
    const loginBody = await loginRes.json();
    expect(loginBody.success).toBe(true);
    expect(mockSignInWithOtp).toHaveBeenCalledWith(
      expect.objectContaining({
        email: "2025uit3090@nsut.ac.in",
      })
    );

    // -------------------------------------------------------------------------
    // Step 2: Complete /auth/callback.
    // -------------------------------------------------------------------------
    const userAccount = {
      id: "u-scenario",
      email: "2025uit3090@nsut.ac.in",
      email_confirmed_at: "2026-09-04T00:00:00Z",
    };
    mockExchangeCodeForSession.mockResolvedValueOnce({
      data: { session: { access_token: "mock-access-token" } },
      error: null,
    });
    currentAuthUser = userAccount;

    const callbackReq = new NextRequest("http://localhost:3000/auth/callback?code=otp-code-abc&next=/verify");
    const callbackRes = await callbackGET(callbackReq);

    expect(callbackRes.status).toBe(307);
    // User is not yet onboarded, so callback directs them to /verify
    expect(callbackRes.headers.get("location")).toBe("http://localhost:3000/verify");
    const callbackCookies = callbackRes.headers.get("set-cookie");
    expect(callbackCookies).toBeDefined();

    // -------------------------------------------------------------------------
    // Step 3: Complete onboarding.
    // -------------------------------------------------------------------------
    mockUpdateUser.mockResolvedValueOnce({ data: { user: userAccount }, error: null });

    const verifyReq = new NextRequest("http://localhost:3000/api/auth/verify", {
      method: "POST",
      body: JSON.stringify({ collegeId: "2025UIT3090" }),
    });
    const verifyRes = await verifyPOST(verifyReq);
    expect(verifyRes.status).toBe(200);
    const verifyBody = await verifyRes.json();
    expect(verifyBody.success).toBe(true);
    expect(verifyRes.headers.get("set-cookie")).toContain("campus_onboarded=true");

    // Now mark the user as onboarded in the DB
    dbUserRecord = {
      id: "u-scenario",
      collegeId: "2025UIT3090",
      collegeEmail: "2025uit3090@nsut.ac.in",
      cohortId: "c-2029",
      role: "student",
      status: "active",
      cohort: { id: "c-2029", graduationYear: 2029 },
      anonymousIdentities: [
        { id: "ai-1", displayName: "Anonymous Owl", avatarSeed: "seed" },
      ],
    };

    // -------------------------------------------------------------------------
    // Step 4: Reach /chat.
    // -------------------------------------------------------------------------
    const chatReq = new NextRequest("http://localhost:3000/chat", {
      headers: {
        cookie: "sb-mock-auth-token=mock-access-token; campus_onboarded=true",
      },
    });
    const chatMidRes = await middleware(chatReq);
    // User is onboarded and authenticated, middleware lets request through (not 307)
    expect(chatMidRes.status).not.toBe(307);

    // ChatPage renders without redirecting
    const chatPageRes = await ChatPage();
    expect(chatPageRes).toBeDefined();

    // -------------------------------------------------------------------------
    // Step 5 & 6: Close the browser/tab. Open Campus again (visiting "/").
    // -------------------------------------------------------------------------
    // Persistent cookies are sent by browser upon reopen
    const openReq = new NextRequest("http://localhost:3000/", {
      headers: {
        cookie: "sb-mock-auth-token=mock-access-token; campus_onboarded=true",
      },
    });

    // -------------------------------------------------------------------------
    // Step 7: Confirm the user goes directly to /chat WITHOUT another email.
    // -------------------------------------------------------------------------
    const openMidRes = await middleware(openReq);
    expect(openMidRes.status).toBe(307);
    expect(openMidRes.headers.get("location")).toBe("http://localhost:3000/chat");
    // Verify that NO login email was triggered
    expect(mockSignInWithOtp).toHaveBeenCalledTimes(1); // Only step 1's initial sign-in

    // -------------------------------------------------------------------------
    // Step 8: Refresh /chat several times.
    // -------------------------------------------------------------------------
    for (let i = 0; i < 3; i++) {
      const refreshReq = new NextRequest("http://localhost:3000/chat", {
        headers: {
          cookie: "sb-mock-auth-token=mock-access-token; campus_onboarded=true",
        },
      });
      const refreshMidRes = await middleware(refreshReq);

      // -----------------------------------------------------------------------
      // Step 9: Confirm the user remains authenticated on every refresh.
      // -----------------------------------------------------------------------
      expect(refreshMidRes.status).not.toBe(307);
      // And updated Set-Cookie headers are properly propagated on session refresh
      const setCookieHeader = refreshMidRes.headers.get("set-cookie");
      expect(setCookieHeader).toContain("sb-mock-auth-token=refreshed-token-xyz");
      expect(setCookieHeader).toContain("Max-Age=34560000"); // 400 days persistent
    }

    // -------------------------------------------------------------------------
    // Step 10: Visit /login manually while authenticated.
    // -------------------------------------------------------------------------
    const loginManualReq = new NextRequest("http://localhost:3000/login", {
      headers: {
        cookie: "sb-mock-auth-token=mock-access-token; campus_onboarded=true",
      },
    });
    const loginManualMidRes = await middleware(loginManualReq);

    // -------------------------------------------------------------------------
    // Step 11: Confirm redirect to /chat.
    // -------------------------------------------------------------------------
    expect(loginManualMidRes.status).toBe(307);
    expect(loginManualMidRes.headers.get("location")).toBe("http://localhost:3000/chat");

    // Also verify Server Component redirect if hit directly
    let serverComponentRedirectUrl: string | null = null;
    try {
      await LoginPage();
    } catch (err: any) {
      if (err?.digest?.includes("NEXT_REDIRECT")) {
        serverComponentRedirectUrl = err.digest.split(";")[2];
      }
    }
    expect(serverComponentRedirectUrl).toBe("/chat");

    // Also verify /verify redirects to /chat for onboarded user
    const verifyManualReq = new NextRequest("http://localhost:3000/verify", {
      headers: {
        cookie: "sb-mock-auth-token=mock-access-token; campus_onboarded=true",
      },
    });
    const verifyManualMidRes = await middleware(verifyManualReq);
    expect(verifyManualMidRes.status).toBe(307);
    expect(verifyManualMidRes.headers.get("location")).toBe("http://localhost:3000/chat");

    // -------------------------------------------------------------------------
    // Step 12: Sign out.
    // -------------------------------------------------------------------------
    mockSignOut.mockResolvedValueOnce({ error: null });
    const logoutRes = await logoutPOST();
    expect(logoutRes.status).toBe(200);
    const logoutBody = await logoutRes.json();
    expect(logoutBody.success).toBe(true);
    expect(mockSignOut).toHaveBeenCalled();
    // campus_onboarded cookie expired
    expect(logoutRes.headers.get("set-cookie")).toContain("campus_onboarded=;");

    // Simulate logged-out state
    currentAuthUser = null;
    dbUserRecord = null;

    // -------------------------------------------------------------------------
    // Step 13: Confirm /chat is now protected and redirects to /login.
    // -------------------------------------------------------------------------
    const loggedOutChatReq = new NextRequest("http://localhost:3000/chat");
    const loggedOutChatMidRes = await middleware(loggedOutChatReq);
    expect(loggedOutChatMidRes.status).toBe(307);
    expect(loggedOutChatMidRes.headers.get("location")).toBe("http://localhost:3000/login");
  });
});
