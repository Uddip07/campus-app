import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { isAllowedInstitutionalEmail } from "@/lib/env";
import { sanitizeRedirectPath } from "@/lib/auth/redirect";
import { rateLimitLogin } from "@/lib/rate-limit/limiter";

const loginSchema = z.object({
  email: z.string().email(),
  redirectTo: z.string().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const supabase = createServerSupabaseClient();
    if (!supabase) {
      return NextResponse.json(
        { error: "Supabase configuration is missing on server." },
        { status: 503 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const parseResult = loginSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        { error: "A valid institutional email is required." },
        { status: 400 }
      );
    }

    const { email, redirectTo } = parseResult.data;
    const normalizedEmail = email.trim().toLowerCase();

    // Server-enforced institutional domain check
    if (!isAllowedInstitutionalEmail(normalizedEmail)) {
      return NextResponse.json(
        {
          error: "Access restricted: Only official @nsut.ac.in institutional email addresses are permitted.",
        },
        { status: 400 }
      );
    }

    // Rate limit login link generation
    const rateCheck = await rateLimitLogin(normalizedEmail);
    if (!rateCheck.allowed) {
      return NextResponse.json(
        {
          error: `Login request limit reached. Please wait ${rateCheck.retryAfterSeconds} seconds before requesting another email, or click the confirmation link already sent to your inbox.`,
          retryAfterSeconds: rateCheck.retryAfterSeconds,
        },
        {
          status: 429,
          headers: { "Retry-After": String(rateCheck.retryAfterSeconds) },
        }
      );
    }

    const appOrigin = new URL(req.url).origin;
    const targetNext = sanitizeRedirectPath(redirectTo, "/verify");
    const emailRedirectTo = `${appOrigin}/auth/callback?next=${encodeURIComponent(targetNext)}`;

    const { error: signInError } = await supabase.auth.signInWithOtp({
      email: normalizedEmail,
      options: {
        emailRedirectTo,
      },
    });

    if (signInError) {
      const isSupabaseRateLimit =
        signInError.message.toLowerCase().includes("rate limit") ||
        signInError.status === 429;

      const errorMessage = isSupabaseRateLimit
        ? "Supabase email rate limit exceeded. Please wait a minute before requesting another email, or use the link already sent to your mailbox."
        : signInError.message;

      return NextResponse.json(
        {
          error: errorMessage,
          retryAfterSeconds: isSupabaseRateLimit ? 60 : undefined,
        },
        { status: isSupabaseRateLimit ? 429 : 400 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `Sign-in link sent to ${normalizedEmail}`,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal login error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
