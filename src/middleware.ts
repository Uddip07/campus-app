import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseConfig } from "@/lib/env";

const COOKIE_MAX_AGE = 400 * 24 * 60 * 60; // 400 days persistent

function copyCookies(fromResponse: NextResponse, toResponse: NextResponse): NextResponse {
  fromResponse.cookies.getAll().forEach((cookie) => {
    toResponse.cookies.set(cookie.name, cookie.value, cookie);
  });
  return toResponse;
}

export async function middleware(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl;

  // If a request hits /verify directly with a ?code= or ?token_hash= parameter,
  // route it to /auth/callback so it is properly verified server-side.
  if (pathname === "/verify" && (searchParams.has("code") || searchParams.has("token_hash"))) {
    const callbackUrl = new URL("/auth/callback", request.url);
    if (searchParams.has("code")) {
      callbackUrl.searchParams.set("code", searchParams.get("code")!);
    }
    if (searchParams.has("token_hash")) {
      callbackUrl.searchParams.set("token_hash", searchParams.get("token_hash")!);
    }
    if (searchParams.has("type")) {
      callbackUrl.searchParams.set("type", searchParams.get("type")!);
    }
    callbackUrl.searchParams.set("next", "/verify");
    return NextResponse.redirect(callbackUrl);
  }

  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  const { url, publishableKey, isConfigured } = getSupabaseConfig();
  if (!isConfigured || process.env.OFFLINE_MODE === "true") {
    return response;
  }

  const supabase = createServerClient(url, publishableKey, {
    cookieOptions: {
      path: "/",
      sameSite: "lax",
      maxAge: COOKIE_MAX_AGE,
    },
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet: Array<{ name: string; value: string; options: CookieOptions }>) {
        cookiesToSet.forEach(({ name, value }) => {
          request.cookies.set(name, value);
        });
        response = NextResponse.next({
          request,
        });
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, {
            path: "/",
            sameSite: "lax",
            maxAge: options?.maxAge !== undefined ? options.maxAge : COOKIE_MAX_AGE,
            ...options,
          });
        });
      },
    },
  });

  // Refresh auth token if necessary
  let user = null;
  try {
    const authResult = await supabase.auth.getUser();
    if (
      authResult.error &&
      (authResult.error.message?.includes("Refresh Token") ||
        (authResult.error as any)?.code === "refresh_token_not_found")
    ) {
      await supabase.auth.signOut().catch(() => {});
    }
    user = authResult?.data?.user ?? null;
  } catch {
    user = null;
  }

  // Do not redirect API routes or auth callback
  if (pathname.startsWith("/api/") || pathname.startsWith("/auth/")) {
    return response;
  }

  // Loop breaker & explicit onboarding entry:
  // If request hits /verify with ?setup= (sent by server pages when user has no DB record),
  // NEVER redirect away from /verify, and clear any stale campus_onboarded cookie!
  if (pathname === "/verify" && searchParams.has("setup")) {
    response.cookies.delete("campus_onboarded");
    return response;
  }

  const isOnboarded =
    user?.user_metadata?.onboarded === true ||
    request.cookies.get("campus_onboarded")?.value === "true";

  const isChatRoute = pathname === "/chat" || pathname.startsWith("/chat/");
  const isProtectedRoute = isChatRoute || pathname.startsWith("/admin") || pathname.startsWith("/announcements");

  if (!user) {
    // No valid Supabase session
    if (isProtectedRoute || pathname === "/") {
      return copyCookies(response, NextResponse.redirect(new URL("/login", request.url)));
    }
  } else {
    // Valid Supabase session exists
    if (isOnboarded) {
      // Valid session + onboarding complete visiting /login, /, /verify -> go to /chat
      if (pathname === "/login" || pathname === "/" || pathname === "/verify") {
        return copyCookies(response, NextResponse.redirect(new URL("/chat", request.url)));
      }
    } else {
      // Valid session + onboarding incomplete visiting /login, /, or protected routes -> go to /verify
      if (pathname === "/login" || pathname === "/" || isChatRoute) {
        return copyCookies(response, NextResponse.redirect(new URL("/verify", request.url)));
      }
    }
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - images/media extensions
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
