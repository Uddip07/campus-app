import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// Mock state
let dbUsers: any[] = [];
let dbCohorts: any[] = [{ id: "c-2029", graduationYear: 2029 }];
let dbIdentities: any[] = [];

const mockExchangeCodeForSession = vi.fn();
const mockGetUser = vi.fn();
const mockSignOut = vi.fn();
const mockUpdateUser = vi.fn().mockResolvedValue({ data: {}, error: null });

vi.mock("@supabase/ssr", () => ({
  createServerClient: vi.fn((_url, _key, options) => {
    if (options?.cookies?.setAll) {
      options.cookies.setAll([
        {
          name: "sb-mock-token",
          value: "mock-session-val",
          options: { maxAge: 400 * 24 * 60 * 60, path: "/", sameSite: "lax" },
        },
      ]);
    }
    return {
      auth: {
        exchangeCodeForSession: mockExchangeCodeForSession,
        getUser: mockGetUser,
        signOut: mockSignOut,
        updateUser: mockUpdateUser,
      },
    };
  }),
  createBrowserClient: vi.fn(() => ({
    auth: {
      signInWithOAuth: vi.fn().mockResolvedValue({ data: {}, error: null }),
      getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }),
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
        findFirst: vi.fn(async () => dbUsers[0] || null),
      },
      cohorts: {
        findFirst: vi.fn(async () => dbCohorts[0] || null),
      },
      anonymousIdentities: {
        findFirst: vi.fn(async () => dbIdentities[0] || null),
      },
      rooms: {
        findFirst: vi.fn(async () => ({ id: "r-1", type: "global", name: "All College" })),
      },
      bans: {
        findFirst: vi.fn(async () => null),
      },
    },
  },
  schema: {
    users: { id: "id", collegeEmail: "college_email" },
    cohorts: { id: "id", graduationYear: "graduation_year" },
    rooms: { id: "id", type: "type" },
    bans: { userId: "user_id", expiresAt: "expires_at" },
    anonymousIdentities: { userId: "user_id", createdAt: "created_at" },
  },
}));

// Route imports
import { GET as callbackGET } from "@/app/auth/callback/route";
import { middleware } from "@/middleware";

describe("Campus Google OAuth Authentication Suite (@nsut.ac.in)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dbUsers = [];
    dbIdentities = [];
  });

  describe("OAuth Callback Route Flow", () => {
    it("redirects first-time valid @nsut.ac.in Google user to /verify to truthfully complete student onboarding", async () => {
      mockExchangeCodeForSession.mockResolvedValueOnce({
        data: { session: { access_token: "google-access-tok" } },
        error: null,
      });

      mockGetUser.mockResolvedValueOnce({
        data: {
          user: {
            id: "google-user-new",
            email: "2025uit3090@nsut.ac.in",
            email_confirmed_at: "2026-09-04T12:00:00Z",
            identities: [{ provider: "google", identity_data: { email_verified: true } }],
          },
        },
        error: null,
      });

      const req = new NextRequest("http://localhost:3000/auth/callback?code=google-auth-code");
      const res = await callbackGET(req);

      expect(res.status).toBe(307);
      expect(res.headers.get("location")).toBe("http://localhost:3000/verify");
      expect(mockSignOut).not.toHaveBeenCalled();
    });

    it("re-uses existing Campus user on subsequent Google logins and redirects straight to /chat", async () => {
      // Pre-seed an existing onboarded user
      dbUsers = [
        {
          id: "google-returning-user",
          collegeId: "2025UIT3090",
          collegeEmail: "2025uit3090@nsut.ac.in",
          cohortId: "c-2029",
          cohort: { id: "c-2029", graduationYear: 2029 },
          anonymousIdentities: [{ id: "ai-orig", displayName: "Original Fox", avatarSeed: "seed" }],
        },
      ];

      mockExchangeCodeForSession.mockResolvedValueOnce({
        data: { session: { access_token: "tok" } },
        error: null,
      });

      mockGetUser.mockResolvedValueOnce({
        data: {
          user: {
            id: "google-returning-user",
            email: "2025uit3090@nsut.ac.in",
            email_confirmed_at: "2026-09-04T12:00:00Z",
          },
        },
        error: null,
      });

      const req = new NextRequest("http://localhost:3000/auth/callback?code=code-returning");
      const res = await callbackGET(req);

      expect(res.status).toBe(307);
      expect(res.headers.get("location")).toBe("http://localhost:3000/chat");
      expect(res.headers.get("set-cookie")).toContain("campus_onboarded=true");
      expect(dbUsers.length).toBe(1);
    });

    it("strictly rejects non-NSUT Google account, signs out, and redirects to /login?error=invalid_domain", async () => {
      mockExchangeCodeForSession.mockResolvedValueOnce({
        data: { session: { access_token: "google-access-tok" } },
        error: null,
      });

      mockGetUser.mockResolvedValueOnce({
        data: {
          user: {
            id: "google-user-intruder",
            email: "student@gmail.com",
            email_confirmed_at: "2026-09-04T12:00:00Z",
          },
        },
        error: null,
      });

      const req = new NextRequest("http://localhost:3000/auth/callback?code=google-code-gmail");
      const res = await callbackGET(req);

      expect(res.status).toBe(307);
      expect(res.headers.get("location")).toContain("/login?error=invalid_domain");
      expect(mockSignOut).toHaveBeenCalled();
      expect(dbUsers.length).toBe(0);
    });

    it("rejects user when email is missing or empty", async () => {
      mockExchangeCodeForSession.mockResolvedValueOnce({
        data: { session: { access_token: "tok" } },
        error: null,
      });

      mockGetUser.mockResolvedValueOnce({
        data: {
          user: {
            id: "user-no-email",
            email: null,
          },
        },
        error: null,
      });

      const req = new NextRequest("http://localhost:3000/auth/callback?code=code-no-email");
      const res = await callbackGET(req);

      expect(res.status).toBe(307);
      expect(res.headers.get("location")).toContain("/login?error=invalid_domain");
      expect(mockSignOut).toHaveBeenCalled();
      expect(dbUsers.length).toBe(0);
    });

    it("rejects unconfirmed Google account", async () => {
      mockExchangeCodeForSession.mockResolvedValueOnce({
        data: { session: { access_token: "tok" } },
        error: null,
      });

      mockGetUser.mockResolvedValueOnce({
        data: {
          user: {
            id: "user-unconfirmed",
            email: "2025uit3090@nsut.ac.in",
            email_confirmed_at: null,
            confirmed_at: null,
            identities: [{ provider: "google", identity_data: { email_verified: false } }],
          },
        },
        error: null,
      });

      const req = new NextRequest("http://localhost:3000/auth/callback?code=code-unconfirmed");
      const res = await callbackGET(req);

      expect(res.status).toBe(307);
      expect(res.headers.get("location")).toContain("/login?error=unconfirmed_email");
      expect(mockSignOut).toHaveBeenCalled();
      expect(dbUsers.length).toBe(0);
    });

    it("handles Google OAuth cancellation cleanly without crashing", async () => {
      const req = new NextRequest(
        "http://localhost:3000/auth/callback?error=access_denied&error_description=User+denied+access"
      );
      const res = await callbackGET(req);

      expect(res.status).toBe(307);
      expect(res.headers.get("location")).toContain("/login?error=oauth_cancelled");
      expect(mockExchangeCodeForSession).not.toHaveBeenCalled();
    });
  });

  describe("Middleware and Route Protection", () => {
    it("blocks unauthenticated user from accessing protected /chat route and redirects to /login", async () => {
      mockGetUser.mockResolvedValueOnce({ data: { user: null }, error: null });

      const req = new NextRequest("http://localhost:3000/chat");
      const res = await middleware(req);

      expect(res.status).toBe(307);
      expect(res.headers.get("location")).toBe("http://localhost:3000/login");
    });

    it("redirects authenticated onboarded user from /login directly to /chat", async () => {
      mockGetUser.mockResolvedValueOnce({
        data: {
          user: {
            id: "user-1",
            email: "2025uit3090@nsut.ac.in",
            user_metadata: { onboarded: true },
          },
        },
        error: null,
      });

      const req = new NextRequest("http://localhost:3000/login");
      const res = await middleware(req);

      expect(res.status).toBe(307);
      expect(res.headers.get("location")).toBe("http://localhost:3000/chat");
    });

    it("redirects authenticated onboarded user from /verify directly to /chat", async () => {
      mockGetUser.mockResolvedValueOnce({
        data: {
          user: {
            id: "user-1",
            email: "2025uit3090@nsut.ac.in",
            user_metadata: { onboarded: true },
          },
        },
        error: null,
      });

      const req = new NextRequest("http://localhost:3000/verify");
      const res = await middleware(req);

      expect(res.status).toBe(307);
      expect(res.headers.get("location")).toBe("http://localhost:3000/chat");
    });

    it("redirects authenticated but not onboarded user from /chat to /verify", async () => {
      mockGetUser.mockResolvedValueOnce({
        data: {
          user: {
            id: "user-new",
            email: "2025uit3090@nsut.ac.in",
            user_metadata: {},
          },
        },
        error: null,
      });

      const req = new NextRequest("http://localhost:3000/chat");
      const res = await middleware(req);

      expect(res.status).toBe(307);
      expect(res.headers.get("location")).toBe("http://localhost:3000/verify");
    });
  });
});
