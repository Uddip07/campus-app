import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth/session";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import Link from "next/link";
import { ShieldCheck, Lock, Users, ArrowRight } from "lucide-react";

export default async function HomePage() {
  let user = null;
  let hasAuthSession = false;

  try {
    const supabase = createServerSupabaseClient();
    if (supabase) {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      hasAuthSession = Boolean(session);
    }
    user = await getSessionUser();
  } catch {
    // Database or supabase unconfigured
  }

  if (user) {
    redirect("/chat/all");
  }

  if (hasAuthSession && !user) {
    redirect("/verify");
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-3.5rem)] px-4 text-center max-w-3xl mx-auto py-12">
      <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-secondary/80 border border-border text-xs font-semibold text-muted-foreground mb-6">
        <ShieldCheck className="h-4 w-4 text-emerald-400" />
        Verified NSUT Community
      </div>

      <h1 className="text-4xl sm:text-5xl font-black tracking-tight text-foreground mb-4">
        Speak freely. <br className="hidden sm:inline" />
        <span className="text-primary/90">Stay completely anonymous.</span>
      </h1>

      <p className="text-base text-muted-foreground max-w-xl mb-8 leading-relaxed">
        Campus gives every verified NSUT student a pseudonymous identity. Talk with your entire college or your specific graduation batch without revealing your real name or roll number.
      </p>

      <div className="flex flex-col sm:flex-row items-center gap-3 w-full max-w-xs mb-12">
        <Link
          href="/login"
          className="w-full flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg bg-primary text-primary-foreground font-semibold text-sm hover:opacity-90 transition-opacity"
        >
          Sign In
          <ArrowRight className="h-4 w-4" />
        </Link>
        <Link
          href="/verify"
          className="w-full flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg bg-secondary text-foreground font-semibold text-sm border border-border hover:bg-secondary/80 transition-colors"
        >
          Verify NSUT ID
        </Link>
      </div>

      {/* Feature pillars */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-left w-full">
        <div className="p-4 rounded-lg bg-card border border-border">
          <Lock className="h-5 w-5 text-primary mb-2" />
          <h2 className="text-sm font-bold text-foreground mb-1">Zero Identity Leak</h2>
          <p className="text-xs text-muted-foreground">
            Other students see only your anonymous alias and graduation batch.
          </p>
        </div>
        <div className="p-4 rounded-lg bg-card border border-border">
          <Users className="h-5 w-5 text-primary mb-2" />
          <h2 className="text-sm font-bold text-foreground mb-1">Cohort Rooms</h2>
          <p className="text-xs text-muted-foreground">
            Automatically joined to your official graduation cohort room.
          </p>
        </div>
        <div className="p-4 rounded-lg bg-card border border-border">
          <ShieldCheck className="h-5 w-5 text-emerald-400 mb-2" />
          <h2 className="text-sm font-bold text-foreground mb-1">No Impersonation</h2>
          <p className="text-xs text-muted-foreground">
            Every user is cryptographically verified against NSUT student records.
          </p>
        </div>
      </div>
    </div>
  );
}
