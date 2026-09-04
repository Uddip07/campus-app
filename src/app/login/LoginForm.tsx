"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, Mail, CheckCircle2, Lock, Clock, Info } from "lucide-react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);
  const isSubmittingRef = useRef(false);

  // Client-side auth check fallback in case of client navigation
  useEffect(() => {
    const supabase = createClient();
    if (!supabase) return;

    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        fetch("/api/auth/me").then((res) => {
          if (res.ok) {
            router.replace("/chat");
          } else {
            router.replace("/verify");
          }
        });
      }
    });
  }, [router]);

  // Cooldown countdown timer
  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => {
      setCooldown((prev) => (prev > 1 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();

    // Prevent double submissions or clicking during cooldown
    if (isSubmittingRef.current || loading || cooldown > 0) return;

    const trimmedEmail = email.trim();
    if (!trimmedEmail) return;

    if (!trimmedEmail.toLowerCase().endsWith("@nsut.ac.in")) {
      setError("Access restricted: Only official @nsut.ac.in institutional email addresses are permitted.");
      return;
    }

    isSubmittingRef.current = true;
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: trimmedEmail }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        const retrySecs = typeof data.retryAfterSeconds === "number" ? data.retryAfterSeconds : 0;
        if (retrySecs > 0) {
          setCooldown(retrySecs);
        }
        throw new Error(data.error || "Error sending login email");
      }

      setSent(true);
      // Impose a polite 60s cooldown to protect Supabase SMTP quota
      setCooldown(60);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error sending login email");
    } finally {
      setLoading(false);
      isSubmittingRef.current = false;
    }
  };

  return (
    <div className="flex items-center justify-center min-h-[calc(100vh-3.5rem)] px-4 py-12">
      <div className="w-full max-w-sm bg-card border border-border rounded-xl p-6 sm:p-8 shadow-lg space-y-6">
        <div className="text-center space-y-1">
          <div className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-secondary text-primary mb-2">
            <Lock className="h-5 w-5" />
          </div>
          <h1 className="text-xl font-bold text-foreground">Sign In to Campus</h1>
          <p className="text-xs text-muted-foreground">
            Enter your official NSUT institutional email
          </p>
        </div>

        {error && (
          <div className="p-3 bg-destructive/20 border border-destructive/40 rounded-lg text-xs text-red-200 flex items-start gap-2">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p>{error}</p>
              {cooldown > 0 && (
                <p className="text-[11px] text-red-300 font-mono flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  Please wait {cooldown}s before trying again.
                </p>
              )}
            </div>
          </div>
        )}

        {sent ? (
          <div className="text-center py-4 space-y-3">
            <CheckCircle2 className="h-10 w-10 text-emerald-400 mx-auto" />
            <h2 className="text-sm font-bold text-foreground">Check your NSUT inbox</h2>
            <p className="text-xs text-muted-foreground leading-relaxed">
              We sent a sign-in link to <strong className="text-foreground">{email}</strong>. Click the confirmation link in your email to sign in directly.
            </p>

            <div className="p-3 bg-secondary/60 rounded-lg border border-border text-[11px] text-muted-foreground text-left space-y-1">
              <p className="font-semibold text-foreground flex items-center gap-1">
                <Info className="h-3.5 w-3.5 text-primary" />
                Already have a confirmation email?
              </p>
              <p>
                Confirmation links remain valid for 1 hour. You can click any link already sent to your inbox without requesting another email.
              </p>
            </div>

            {cooldown > 0 ? (
              <p className="text-xs text-muted-foreground pt-1">
                Resend link available in <strong className="text-primary font-mono">{cooldown}s</strong>
              </p>
            ) : (
              <button
                onClick={() => setSent(false)}
                className="text-xs text-primary underline pt-2 block mx-auto"
              >
                Send another link or use a different email
              </button>
            )}
          </div>
        ) : (
          <form onSubmit={handleSignIn} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-muted-foreground mb-1">
                NSUT Institutional Email
              </label>
              <div className="relative">
                <Mail className="h-4 w-4 absolute left-3 top-2.5 text-muted-foreground" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="rollnumber@nsut.ac.in"
                  required
                  disabled={loading}
                  className="w-full bg-secondary border border-border rounded-lg pl-9 pr-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-50"
                />
              </div>
              <p className="text-[11px] text-muted-foreground mt-1">
                Must end with <code className="text-primary font-mono font-semibold">@nsut.ac.in</code>
              </p>
            </div>

            <button
              type="submit"
              disabled={loading || cooldown > 0 || !email}
              className="w-full py-2.5 rounded-lg bg-primary text-primary-foreground font-semibold text-sm hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading
                ? "Sending link..."
                : cooldown > 0
                ? `Wait ${cooldown}s to resend`
                : "Send Verification Sign-in Link"}
            </button>
          </form>
        )}

        <div className="text-center pt-2 border-t border-border/60">
          <Link href="/verify" className="text-xs text-muted-foreground hover:text-foreground">
            Already confirmed? <span className="text-primary font-semibold">Complete Batch Setup</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
