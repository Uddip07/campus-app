"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AlertCircle, Lock, Loader2, ShieldCheck } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

function GoogleIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24">
      <path
        fill="#4285F4"
        d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17Z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.34 24 12 24Z"
      />
      <path
        fill="#FBBC05"
        d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 9.99 0 12s.45 3.82 1.25 5.42l4.03-3.15Z"
      />
      <path
        fill="#EA4335"
        d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.34 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98Z"
      />
    </svg>
  );
}

function LoginFormContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Check URL error parameter and display friendly user error
  useEffect(() => {
    const errorParam = searchParams.get("error");
    if (!errorParam) return;

    switch (errorParam) {
      case "invalid_domain":
        setError("Only @nsut.ac.in Google accounts can access Campus.");
        break;
      case "oauth_cancelled":
        setError("Sign-in was cancelled. Please sign in with your @nsut.ac.in Google account.");
        break;
      case "unconfirmed_email":
        setError("Your Google account email is not verified. Please use an active @nsut.ac.in account.");
        break;
      case "invalid_or_expired_code":
        setError("Sign-in link or authorization code expired. Please sign in again.");
        break;
      case "user_resolution_failed":
        setError("Could not resolve account from Google. Please try again.");
        break;
      case "missing_code":
        setError("Authentication session was not completed. Please sign in again.");
        break;
      default:
        setError("An authentication error occurred. Please try again.");
        break;
    }
  }, [searchParams]);

  // Client-side auth check fallback in case of client navigation
  useEffect(() => {
    const supabase = createClient();
    if (!supabase) return;

    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        router.replace("/chat");
      }
    });
  }, [router]);

  const handleGoogleSignIn = async () => {
    if (loading) return;

    setLoading(true);
    setError(null);

    try {
      const supabase = createClient();
      if (!supabase) {
        throw new Error("Campus authentication service is not configured.");
      }

      const nextParam = searchParams.get("next");
      const origin = typeof window !== "undefined" ? window.location.origin : "";
      const redirectTo = `${origin}/auth/callback${
        nextParam ? `?next=${encodeURIComponent(nextParam)}` : ""
      }`;

      const { error: signInError } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo,
          queryParams: {
            prompt: "select_account",
            hd: "nsut.ac.in",
          },
        },
      });

      if (signInError) {
        throw signInError;
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to initiate Google sign in.");
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-[calc(100vh-3.5rem)] px-4 py-12">
      <div className="w-full max-w-sm bg-card border border-border rounded-xl p-6 sm:p-8 shadow-lg space-y-6">
        <div className="text-center space-y-2">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-secondary text-primary mb-1">
            <Lock className="h-6 w-6" />
          </div>
          <h1 className="text-xl font-bold text-foreground tracking-tight">Sign In to Campus</h1>
          <p className="text-xs text-muted-foreground">
            Connect using your official NSUT institutional account
          </p>
        </div>

        {error && (
          <div className="p-3.5 bg-destructive/20 border border-destructive/40 rounded-lg text-xs text-red-200 flex items-start gap-2.5 leading-relaxed">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-red-400" />
            <div className="space-y-0.5">
              <p className="font-semibold text-red-200">Authentication Alert</p>
              <p className="text-red-300/90">{error}</p>
            </div>
          </div>
        )}

        <div className="space-y-4 pt-1">
          <button
            type="button"
            onClick={handleGoogleSignIn}
            disabled={loading}
            className="w-full py-3 px-4 rounded-lg bg-white text-zinc-900 font-semibold text-sm hover:bg-zinc-100 transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3 border border-zinc-200"
          >
            {loading ? (
              <Loader2 className="h-5 w-5 animate-spin text-zinc-600" />
            ) : (
              <GoogleIcon className="h-5 w-5" />
            )}
            <span>{loading ? "Connecting to Google..." : "Continue with Google"}</span>
          </button>

          <div className="flex items-center justify-center gap-1.5 text-[11px] text-muted-foreground font-medium text-center">
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
            <span>Use your <code className="text-primary font-mono font-semibold">@nsut.ac.in</code> Google account</span>
          </div>
        </div>

        <div className="p-3 bg-secondary/50 rounded-lg border border-border text-[11px] text-muted-foreground leading-relaxed text-center space-y-1">
          <p className="font-medium text-foreground">Anonymous & Encrypted</p>
          <p>
            Your Google credentials authenticate your verified campus enrollment. Real names and email addresses are never revealed in public channels.
          </p>
        </div>
      </div>
    </div>
  );
}

export function LoginForm() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-[calc(100vh-3.5rem)]">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      }
    >
      <LoginFormContent />
    </Suspense>
  );
}
