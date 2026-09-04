import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// Mock Supabase SSR client
const mockExchangeCodeForSession = vi.fn();
const mockGetUser = vi.fn();
const mockSignOut = vi.fn();

vi.mock("@supabase/ssr", () => ({
  createServerClient: vi.fn(() => ({
    auth: {
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

// Import route after mocks are configured
import { GET } from "@/app/auth/callback/route";

describe("Auth Callback Route Handler (GET /auth/callback)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns client-side hash handler when ?code= is absent", async () => {
    const req = new NextRequest("http://localhost:3000/auth/callback");
    const response = await GET(req);

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/html");
    const body = await response.text();
    expect(body).toContain("/login?error=missing_code");
    expect(mockExchangeCodeForSession).not.toHaveBeenCalled();
  });

  it("handles expired, invalid, or already-used PKCE codes gracefully", async () => {
    mockExchangeCodeForSession.mockResolvedValueOnce({
      data: { session: null, user: null },
      error: new Error("AuthApiError: PKCE code has expired or is invalid"),
    });

    const req = new NextRequest("http://localhost:3000/auth/callback?code=expired-or-used-code");
    const response = await GET(req);

    expect(response.status).toBe(307);
    const location = response.headers.get("location");
    expect(location).toContain("/login?error=invalid_or_expired_code");
    expect(mockExchangeCodeForSession).toHaveBeenCalledWith("expired-or-used-code");
  });

  it("strictly rejects non-institutional email accounts after code exchange", async () => {
    mockExchangeCodeForSession.mockResolvedValueOnce({
      data: { session: { access_token: "token" } },
      error: null,
    });
    mockGetUser.mockResolvedValueOnce({
      data: {
        user: {
          id: "user-123",
          email: "student@gmail.com",
        },
      },
      error: null,
    });

    const req = new NextRequest("http://localhost:3000/auth/callback?code=valid-code-bad-domain");
    const response = await GET(req);

    expect(response.status).toBe(307);
    const location = response.headers.get("location");
    expect(location).toContain("/login?error=invalid_domain");
    expect(mockSignOut).toHaveBeenCalled();
  });

  it("exchanges valid code for session, enforces @nsut.ac.in domain, and sanitizes open redirects", async () => {
    mockExchangeCodeForSession.mockResolvedValueOnce({
      data: { session: { access_token: "token" } },
      error: null,
    });
    mockGetUser.mockResolvedValueOnce({
      data: {
        user: {
          id: "user-123",
          email: "2025uit3090@nsut.ac.in",
          email_confirmed_at: "2026-09-04T00:00:00Z",
        },
      },
      error: null,
    });

    // Attacker tries to supply an external open redirect target
    const req = new NextRequest(
      "http://localhost:3000/auth/callback?code=valid-pkce-code&next=https://evil.com"
    );
    const response = await GET(req);

    expect(response.status).toBe(307);
    const location = response.headers.get("location");
    // Open redirect sanitized to /verify
    expect(location).toBe("http://localhost:3000/verify");
  });

  it("exchanges valid code and redirects to legitimate relative next path", async () => {
    mockExchangeCodeForSession.mockResolvedValueOnce({
      data: { session: { access_token: "token" } },
      error: null,
    });
    mockGetUser.mockResolvedValueOnce({
      data: {
        user: {
          id: "user-123",
          email: "2025uit3090@nsut.ac.in",
          email_confirmed_at: "2026-09-04T00:00:00Z",
        },
      },
      error: null,
    });

    const req = new NextRequest(
      "http://localhost:3000/auth/callback?code=valid-pkce-code&next=/chat/all"
    );
    const response = await GET(req);

    expect(response.status).toBe(307);
    const location = response.headers.get("location");
    expect(location).toBe("http://localhost:3000/chat/all");
  });

  it("strictly rejects unconfirmed email accounts after code exchange", async () => {
    mockExchangeCodeForSession.mockResolvedValueOnce({
      data: { session: { access_token: "token" } },
      error: null,
    });
    mockGetUser.mockResolvedValueOnce({
      data: {
        user: {
          id: "user-123",
          email: "2025uit3090@nsut.ac.in",
          email_confirmed_at: null,
          confirmed_at: null,
        },
      },
      error: null,
    });

    const req = new NextRequest("http://localhost:3000/auth/callback?code=valid-code-unconfirmed");
    const response = await GET(req);

    expect(response.status).toBe(307);
    const location = response.headers.get("location");
    expect(location).toContain("/login?error=unconfirmed_email");
    expect(mockSignOut).toHaveBeenCalled();
  });
});
