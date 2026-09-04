import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseConfig } from "@/lib/env";

export async function middleware(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl;

  // If a request hits /verify directly with a ?code= or ?token_hash= parameter (e.g. from an email link),
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
  if (!isConfigured) {
    return response;
  }

  const supabase = createServerClient(url, publishableKey, {
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
          response.cookies.set(name, value, options);
        });
      },
    },
  });

  // Refresh auth token if necessary
  await supabase.auth.getUser();

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
