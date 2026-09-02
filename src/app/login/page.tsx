"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { AlertCircle, Mail, CheckCircle2, Lock } from "lucide-react";
import Link from "next/link";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const supabase = createClient();

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;

    if (!supabase) {
      setError("Supabase configuration is missing. NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY must be configured.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const { error: signInError } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: `${window.location.origin}/verify`,
        },
      });

      if (signInError) {
        throw signInError;
      }

      setSent(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error sending login email");
    } finally {
      setLoading(false);
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
            Enter your email to receive a secure sign-in link
          </p>
        </div>

        {!supabase && (
          <div className="p-3 bg-destructive/20 border border-destructive/40 rounded-lg text-xs text-red-200 flex items-start gap-2">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">Configuration Error</p>
              <p>Supabase configuration is missing. Please configure NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.</p>
            </div>
          </div>
        )}

        {error && (
          <div className="p-3 bg-destructive/20 border border-destructive/40 rounded-lg text-xs text-red-200 flex items-start gap-2">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
            <p>{error}</p>
          </div>
        )}

        {sent ? (
          <div className="text-center py-4 space-y-3">
            <CheckCircle2 className="h-10 w-10 text-emerald-400 mx-auto" />
            <h2 className="text-sm font-bold text-foreground">Check your email</h2>
            <p className="text-xs text-muted-foreground">
              We sent a sign-in link to <strong className="text-foreground">{email}</strong>. Click the link to complete authentication.
            </p>
            <button
              onClick={() => setSent(false)}
              className="text-xs text-primary underline pt-2 block mx-auto"
            >
              Use a different email
            </button>
          </div>
        ) : (
          <form onSubmit={handleSignIn} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-muted-foreground mb-1">
                Institutional / Personal Email
              </label>
              <div className="relative">
                <Mail className="h-4 w-4 absolute left-3 top-2.5 text-muted-foreground" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="student@nsut.ac.in"
                  required
                  disabled={!supabase || loading}
                  className="w-full bg-secondary border border-border rounded-lg pl-9 pr-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-50"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={!supabase || loading || !email}
              className="w-full py-2.5 rounded-lg bg-primary text-primary-foreground font-semibold text-sm hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? "Sending link..." : "Send Sign-in Link"}
            </button>
          </form>
        )}

        <div className="text-center pt-2 border-t border-border/60">
          <Link href="/verify" className="text-xs text-muted-foreground hover:text-foreground">
            Already authenticated? <span className="text-primary font-semibold">Verify Student ID</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
