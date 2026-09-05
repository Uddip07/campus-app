import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { sanitizeRedirectPath } from "@/lib/auth/redirect";
import { middleware } from "@/middleware";

// Mocks for Supabase
const mockSignInWithOtp = vi.fn();
const mockExchangeCodeForSession = vi.fn();
const mockGetUser = vi.fn();
const mockSignOut = vi.fn();

vi.mock("@supabase/ssr", () => ({
  createServerClient: vi.fn((_url, _key, options) => {
    // If setAll is passed, simulate saving cookies
    if (options?.cookies?.setAll) {
      options.cookies.setAll([
        {
          name: "sb-mock-auth-token",
          value: "mock-session-token",
          options: { httpOnly: true, path: "/" },
        },
      ]);
    }
    return {
      auth: {
        signInWithOtp: mockSignInWithOtp,
        exchangeCodeForSession: mockExchangeCodeForSession,
        getUser: mockGetUser,
        signOut: mockSignOut,
      },
    };
  }),
}));

vi.mock("next/headers", () => ({
  cookies: vi.fn(() => ({
    getAll: vi.fn(() => []),
    set: vi.fn(),
  })),
}));

vi.mock("@/lib/supabase/server", () => ({
  createServerSupabaseClient: vi.fn(() => ({
    auth: {
      signInWithOtp: mockSignInWithOtp,
      exchangeCodeForSession: mockExchangeCodeForSession,
      getUser: mockGetUser,
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

// Import route handlers after mocks
import { POST as loginPOST } from "@/app/api/auth/login/route";
import { GET as callbackGET } from "@/app/auth/callback/route";
import { POST as verifyPOST } from "@/app/api/auth/verify/route";
import { POST as logoutPOST } from "@/app/api/auth/logout/route";
import { getAuthenticatedAuthUser } from "@/lib/auth/session";

describe("Complete 16-Point Supabase Auth & Session Verification Suite", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // 1. Login generates the correct callback redirect
  it("1. Login generates the correct callback redirect pointing to /auth/callback?next=/verify", async () => {
    mockSignInWithOtp.mockResolvedValueOnce({ data: {}, error: null });

    const req = new NextRequest("http://localhost:3000/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email: "2025uit3090@nsut.ac.in", redirectTo: "/verify" }),
    });

    const res = await loginPOST(req);
    expect(res.status).toBe(200);
    expect(mockSignInWithOtp).toHaveBeenCalledWith(
      expect.objectContaining({
        email: "2025uit3090@nsut.ac.in",
        options: expect.objectContaining({
          emailRedirectTo: "http://localhost:3000/auth/callback?next=%2Fverify",
        }),
      })
    );
  });

  // 2. Valid callback code establishes a Supabase session
  it("2. Valid callback code calls exchangeCodeForSession with the authorization code", async () => {
    mockExchangeCodeForSession.mockResolvedValueOnce({
      data: { session: { access_token: "tok" } },
      error: null,
    });
    mockGetUser.mockResolvedValueOnce({
      data: {
        user: {
          id: "u-1",
          email: "2025uit3090@nsut.ac.in",
          email_confirmed_at: "2026-09-04T00:00:00Z",
        },
      },
      error: null,
    });

    const req = new NextRequest("http://localhost:3000/auth/callback?code=valid-code-123");
    const res = await callbackGET(req);

    expect(mockExchangeCodeForSession).toHaveBeenCalledWith("valid-code-123");
    expect(res.status).toBe(307);
  });

  // 3. Callback cookies are persisted
  it("3. Callback cookies are written into the HTTP response headers", async () => {
    mockExchangeCodeForSession.mockResolvedValueOnce({
      data: { session: { access_token: "tok" } },
      error: null,
    });
    mockGetUser.mockResolvedValueOnce({
      data: {
        user: {
          id: "u-1",
          email: "2025uit3090@nsut.ac.in",
          email_confirmed_at: "2026-09-04T00:00:00Z",
        },
      },
      error: null,
    });

    const req = new NextRequest("http://localhost:3000/auth/callback?code=valid-code-123");
    const res = await callbackGET(req);

    const setCookie = res.headers.get("set-cookie");
    expect(setCookie).toBeDefined();
    expect(setCookie).toContain("sb-mock-auth-token");
  });

  // 4. User is redirected to /verify after successful callback
  it("4. User is redirected to /verify after successful callback", async () => {
    mockExchangeCodeForSession.mockResolvedValueOnce({
      data: { session: { access_token: "tok" } },
      error: null,
    });
    mockGetUser.mockResolvedValueOnce({
      data: {
        user: {
          id: "u-1",
          email: "2025uit3090@nsut.ac.in",
          email_confirmed_at: "2026-09-04T00:00:00Z",
        },
      },
      error: null,
    });

    const req = new NextRequest("http://localhost:3000/auth/callback?code=valid-code-123&next=/verify");
    const res = await callbackGET(req);

    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe("http://localhost:3000/verify");
  });

  // 5. /verify recognizes the authenticated user
  it("5. /verify session resolver recognizes the authenticated Supabase user", async () => {
    mockGetUser.mockResolvedValueOnce({
      data: {
        user: {
          id: "u-1",
          email: "2025uit3090@nsut.ac.in",
          email_confirmed_at: "2026-09-04T00:00:00Z",
        },
      },
      error: null,
    });

    const authUser = await getAuthenticatedAuthUser();
    expect(authUser).toBeDefined();
    expect(authUser?.email).toBe("2025uit3090@nsut.ac.in");
  });

  // 6. Unauthenticated user cannot complete verification
  it("6. Unauthenticated user cannot complete verification (returns 401)", async () => {
    mockGetUser.mockResolvedValueOnce({
      data: { user: null },
      error: null,
    });

    const req = new NextRequest("http://localhost:3000/api/auth/verify", {
      method: "POST",
      body: JSON.stringify({ collegeId: "2025UIT3090" }),
    });

    const res = await verifyPOST(req);
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toContain("Authentication required");
  });

  // 7. Non-NSUT email cannot complete institutional verification
  it("7. Non-NSUT email cannot complete institutional verification (returns 403)", async () => {
    mockGetUser.mockResolvedValueOnce({
      data: {
        user: {
          id: "u-bad",
          email: "student@gmail.com",
          email_confirmed_at: "2026-09-04T00:00:00Z",
        },
      },
      error: null,
    });

    const req = new NextRequest("http://localhost:3000/api/auth/verify", {
      method: "POST",
      body: JSON.stringify({ collegeId: "2025UIT3090" }),
    });

    const res = await verifyPOST(req);
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toContain("Only verified @nsut.ac.in institutional email addresses are permitted");
  });

  // 8. Unconfirmed email cannot complete verification
  it("8. Unconfirmed email cannot complete verification (returns 403)", async () => {
    mockGetUser.mockResolvedValueOnce({
      data: {
        user: {
          id: "u-unconfirmed",
          email: "2025uit3090@nsut.ac.in",
          email_confirmed_at: null,
          confirmed_at: null,
        },
      },
      error: null,
    });

    const req = new NextRequest("http://localhost:3000/api/auth/verify", {
      method: "POST",
      body: JSON.stringify({ collegeId: "2025UIT3090" }),
    });

    const res = await verifyPOST(req);
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toContain("Institutional email must be confirmed");
  });

  // 9. Invalid callback code fails safely
  it("9. Invalid callback code fails safely and redirects to /login?error=invalid_or_expired_code", async () => {
    mockExchangeCodeForSession.mockResolvedValueOnce({
      data: { session: null, user: null },
      error: new Error("AuthApiError: Invalid authorization code"),
    });

    const req = new NextRequest("http://localhost:3000/auth/callback?code=invalid-code");
    const res = await callbackGET(req);

    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain("/login?error=invalid_or_expired_code");
  });

  // 10. Expired callback code fails safely
  it("10. Expired callback code fails safely and redirects to /login?error=invalid_or_expired_code", async () => {
    mockExchangeCodeForSession.mockResolvedValueOnce({
      data: { session: null, user: null },
      error: new Error("AuthApiError: Authorization code expired"),
    });

    const req = new NextRequest("http://localhost:3000/auth/callback?code=expired-code");
    const res = await callbackGET(req);

    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain("/login?error=invalid_or_expired_code");
  });

  // 11. Already-used callback code fails safely
  it("11. Already-used callback code fails safely and redirects to /login?error=invalid_or_expired_code", async () => {
    mockExchangeCodeForSession.mockResolvedValueOnce({
      data: { session: null, user: null },
      error: new Error("AuthApiError: Authorization code has already been used"),
    });

    const req = new NextRequest("http://localhost:3000/auth/callback?code=used-code");
    const res = await callbackGET(req);

    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain("/login?error=invalid_or_expired_code");
  });

  // 12. External next URL is rejected
  it("12. External next URL is rejected and sanitized to safe relative path", () => {
    expect(sanitizeRedirectPath("https://evil.com")).toBe("/verify");
    expect(sanitizeRedirectPath("//evil.com")).toBe("/verify");
    expect(sanitizeRedirectPath("javascript:alert(1)")).toBe("/verify");
    expect(sanitizeRedirectPath("data:text/html,attack")).toBe("/verify");
  });

  // 13. Internal next=/verify works
  it("13. Internal next=/verify is accepted as valid target", () => {
    expect(sanitizeRedirectPath("/verify")).toBe("/verify");
    expect(sanitizeRedirectPath("/chat/all")).toBe("/chat/all");
  });

  // 14. Authenticated-but-not-onboarded user is not treated as logged out
  it("14. Authenticated-but-not-onboarded user is recognized by getAuthenticatedAuthUser", async () => {
    mockGetUser.mockResolvedValueOnce({
      data: {
        user: {
          id: "u-new",
          email: "2025uit3090@nsut.ac.in",
          email_confirmed_at: "2026-09-04T00:00:00Z",
        },
      },
      error: null,
    });

    const authUser = await getAuthenticatedAuthUser();
    expect(authUser).not.toBeNull();
    expect(authUser?.email).toBe("2025uit3090@nsut.ac.in");
  });

  // 15. Logout still works
  it("15. Logout route successfully signs out and returns success", async () => {
    mockSignOut.mockResolvedValueOnce({ error: null });

    const res = await logoutPOST();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(mockSignOut).toHaveBeenCalled();
  });

  // 16. No auth redirect loop occurs
  it("16. No auth redirect loop occurs between middleware, /verify, and /auth/callback", async () => {
    // A: Request to /verify?code=123 is forwarded to /auth/callback?code=123&next=/verify
    const reqWithCode = new NextRequest("http://localhost:3000/verify?code=123");
    const midResA = await middleware(reqWithCode);
    expect(midResA.status).toBe(307);
    expect(midResA.headers.get("location")).toBe("http://localhost:3000/auth/callback?code=123&next=%2Fverify");

    // B: Request to /verify WITHOUT code does NOT redirect, allowing the page to render
    const reqWithoutCode = new NextRequest("http://localhost:3000/verify");
    const midResB = await middleware(reqWithoutCode);
    expect(midResB.status).not.toBe(307);
    expect(midResB.headers.get("location")).toBeNull();

    // C: Request to /verify?setup=required clears any stale campus_onboarded cookie and allows page to render without looping to /chat
    const reqWithSetup = new NextRequest("http://localhost:3000/verify?setup=required", {
      headers: {
        cookie: "campus_onboarded=true",
      },
    });
    const midResC = await middleware(reqWithSetup);
    expect(midResC.status).not.toBe(307);
    expect(midResC.headers.get("location")).toBeNull();
    expect(midResC.headers.get("set-cookie")).toContain("campus_onboarded=;");
  });
});
