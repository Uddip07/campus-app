"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ShieldCheck, AlertCircle, ArrowRight, CheckCircle, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";

interface VerifyClientFormProps {
  initialEmail?: string | null;
}

export function VerifyClientForm({ initialEmail }: VerifyClientFormProps) {
  const router = useRouter();
  const [collegeId, setCollegeId] = useState("");
  const [loading, setLoading] = useState(false);
  const [authLoading, setAuthLoading] = useState(!initialEmail);
  const [authenticatedEmail, setAuthenticatedEmail] = useState<string | null>(initialEmail ?? null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Check if code or token_hash query parameter exists from an email link
    const searchParams = new URLSearchParams(window.location.search);
    const code = searchParams.get("code");
    const tokenHash = searchParams.get("token_hash");
    if (code || tokenHash) {
      const forwardParams = new URLSearchParams(window.location.search);
      forwardParams.set("next", "/verify");
      router.replace(`/auth/callback?${forwardParams.toString()}`);
      return;
    }

    // Check if already onboarded via API
    fetch("/api/auth/me").then((res) => {
      if (res.ok) {
        router.replace("/chat");
      }
    });

    const supabase = createClient();
    if (!supabase) {
      setAuthLoading(false);
      return;
    }

    // Initial check for existing session
    supabase.auth.getUser().then(({ data: { user }, error: userError }) => {
      if (user && !userError) {
        setAuthenticatedEmail(user.email ?? null);
      }
      setAuthLoading(false);
    });

    // Listen to reactive auth state changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user?.email) {
        setAuthenticatedEmail(session.user.email);
        setAuthLoading(false);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [router]);

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/auth/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          collegeId: collegeId.trim(),
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data.error || "Verification failed");
      }

      router.push("/chat");
      router.refresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Verification error occurred");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-[calc(100vh-3.5rem)] px-4 py-12">
      <div className="w-full max-w-md bg-card border border-border rounded-xl p-6 sm:p-8 shadow-lg space-y-6">
        <div className="text-center space-y-1">
          <div className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-emerald-950/60 border border-emerald-800/50 text-emerald-400 mb-2">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <h1 className="text-xl font-bold text-foreground">Verified NSUT Institutional Email</h1>
          <p className="text-xs text-muted-foreground">
            Complete your cohort room placement to receive your anonymous identity
          </p>
        </div>

        {authLoading ? (
          <div className="p-6 text-center text-xs text-muted-foreground flex items-center justify-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin text-primary" />
            <span>Checking authentication status...</span>
          </div>
        ) : authenticatedEmail ? (
          <div className="p-3 bg-emerald-950/30 border border-emerald-800/40 rounded-lg text-xs text-emerald-300 flex items-start gap-2">
            <CheckCircle className="h-4 w-4 shrink-0 mt-0.5 text-emerald-400" />
            <div>
              <p className="font-semibold">Institutional Mailbox Confirmed</p>
              <p className="text-[11px] text-emerald-400/90 mt-0.5 font-mono">
                {authenticatedEmail}
              </p>
            </div>
          </div>
        ) : (
          <div className="p-4 bg-secondary/70 border border-border rounded-lg text-xs space-y-3">
            <p className="font-semibold text-foreground">Sign In Required</p>
            <p className="text-muted-foreground">
              Please sign in with your official @nsut.ac.in email before completing student verification.
            </p>
            <Link
              href="/login"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground font-semibold text-xs hover:opacity-90 transition-opacity"
            >
              Sign In with NSUT Email
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        )}

        {error && (
          <div className="p-3 bg-destructive/20 border border-destructive/40 rounded-lg text-xs text-red-200 flex items-start gap-2">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">Setup Error</p>
              <p>{error}</p>
            </div>
          </div>
        )}

        {authenticatedEmail && (
          <form onSubmit={handleVerify} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-muted-foreground mb-1">
                NSUT College Roll Number / Student ID
              </label>
              <input
                type="text"
                value={collegeId}
                onChange={(e) => setCollegeId(e.target.value.toUpperCase())}
                placeholder="e.g. 2025UIT3090 or 2024COE1020"
                required
                className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm font-mono text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-1 focus:ring-primary uppercase"
              />
              <p className="text-[11px] text-muted-foreground mt-1">
                Format: Year + Branch Code + Roll Number (e.g. 2025UIT3090). Used for graduation cohort room placement.
              </p>
            </div>

            <button
              type="submit"
              disabled={loading || !collegeId}
              className="w-full py-2.5 rounded-lg bg-primary text-primary-foreground font-semibold text-sm hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading ? "Configuring Identity..." : "Complete Setup & Receive Anonymous Identity"}
              <ArrowRight className="h-4 w-4" />
            </button>
          </form>
        )}

        <div className="p-3 bg-secondary/50 rounded-lg border border-border text-[11px] text-muted-foreground leading-relaxed space-y-1">
          <p>
            <strong className="text-foreground">Verification Notice:</strong> Verification state is <em>Verified NSUT institutional email</em>. Student ID is self-reported for graduation cohort placement and is not claimed to be independently verified by external NSUT authorities.
          </p>
          <p>
            <strong className="text-foreground">Privacy Guarantee:</strong> Your real college ID and email will never be exposed in public chats, messages, or reactions.
          </p>
        </div>
      </div>
    </div>
  );
}
