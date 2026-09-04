import { NextRequest, NextResponse } from "next/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { getSupabaseConfig, isAllowedInstitutionalEmail } from "@/lib/env";
import { sanitizeRedirectPath } from "@/lib/auth/redirect";

import { type EmailOtpType } from "@supabase/supabase-js";

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const token_hash = requestUrl.searchParams.get("token_hash");
  const type = requestUrl.searchParams.get("type") as EmailOtpType | null;
  const next = sanitizeRedirectPath(requestUrl.searchParams.get("next"), "/verify");

  const { url, publishableKey, isConfigured } = getSupabaseConfig();
  if (!isConfigured) {
    return NextResponse.redirect(new URL("/login?error=supabase_unconfigured", request.url));
  }

  if (!code && !(token_hash && type)) {
    // If no query parameter ?code= or ?token_hash= exists, check if client URL has an implicit hash fragment (#access_token=...)
    // Render a lightweight HTML fallback so the browser's JavaScript can process the hash before falling back to login.
    const html = `<!DOCTYPE html>
<html>
<head>
  <title>Authenticating Campus Session...</title>
  <meta http-equiv="refresh" content="3;url=/login?error=missing_code">
</head>
<body style="background:#09090b;color:#a1a1aa;font-family:system-ui,-apple-system,sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;">
  <p>Verifying authentication, please wait...</p>
  <script>
    try {
      var hash = window.location.hash;
      if (hash && (hash.indexOf("access_token") !== -1 || hash.indexOf("type=recovery") !== -1)) {
        window.location.replace("${next}" + hash);
      } else {
        window.location.replace("/login?error=missing_code");
      }
    } catch (e) {
      window.location.replace("/login?error=missing_code");
    }
  </script>
</body>
</html>`;
    return new NextResponse(html, {
      status: 200,
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  }

  // Create redirect response pointing to the sanitized relative target
  const redirectTarget = new URL(next, request.url);
  const response = NextResponse.redirect(redirectTarget);

  const supabase = createServerClient(url, publishableKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet: Array<{ name: string; value: string; options: CookieOptions }>) {
        cookiesToSet.forEach(({ name, value, options }) => {
          request.cookies.set(name, value);
          response.cookies.set(name, value, options);
        });
      },
    },
  });

  // Verify either via token_hash (for custom email templates) or PKCE authorization code
  if (token_hash && type) {
    const { error: verifyError } = await supabase.auth.verifyOtp({ token_hash, type });
    if (verifyError) {
      console.error("[AuthCallback] verifyOtp failed:", verifyError.message);
      return NextResponse.redirect(new URL("/login?error=invalid_or_expired_code", request.url));
    }
  } else if (code) {
    const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
    if (exchangeError) {
      console.error("[AuthCallback] Code exchange failed:", exchangeError.message);
      return NextResponse.redirect(new URL("/login?error=invalid_or_expired_code", request.url));
    }
  }

  // Strictly validate the authenticated user and confirmed email domain server-side
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    console.error("[AuthCallback] Failed to resolve user after code exchange:", userError?.message);
    return NextResponse.redirect(new URL("/login?error=user_resolution_failed", request.url));
  }

  const userEmail = user.email?.trim().toLowerCase();
  if (!userEmail || !isAllowedInstitutionalEmail(userEmail)) {
    console.warn(`[AuthCallback] Rejected non-institutional email domain: ${userEmail}`);
    await supabase.auth.signOut();
    return NextResponse.redirect(new URL("/login?error=invalid_domain", request.url));
  }

  const isEmailConfirmed = Boolean(user.email_confirmed_at || user.confirmed_at);
  if (!isEmailConfirmed) {
    console.warn(`[AuthCallback] User email is not confirmed: ${userEmail}`);
    await supabase.auth.signOut();
    return NextResponse.redirect(new URL("/login?error=unconfirmed_email", request.url));
  }

  return response;
}
