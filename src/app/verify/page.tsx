"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ShieldCheck, AlertCircle, ArrowRight } from "lucide-react";

export default function VerifyPage() {
  const router = useRouter();
  const [collegeId, setCollegeId] = useState("");
  const [collegeEmail, setCollegeEmail] = useState("");
  const [token, setToken] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
          collegeEmail: collegeEmail.trim() || undefined,
          verificationToken: token.trim() || undefined,
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data.error || "Student verification failed");
      }

      router.push("/chat/all");
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
          <h1 className="text-xl font-bold text-foreground">Verify NSUT Student Status</h1>
          <p className="text-xs text-muted-foreground">
            Link your institutional student record to receive your anonymous identity
          </p>
        </div>

        {error && (
          <div className="p-3 bg-destructive/20 border border-destructive/40 rounded-lg text-xs text-red-200 flex items-start gap-2">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">Verification Error</p>
              <p>{error}</p>
            </div>
          </div>
        )}

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
              Format: Year + Branch Code + Roll Number (e.g. 2025UIT3090)
            </p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-muted-foreground mb-1">
              NSUT Institutional Email (Optional)
            </label>
            <input
              type="email"
              value={collegeEmail}
              onChange={(e) => setCollegeEmail(e.target.value)}
              placeholder="student@nsut.ac.in"
              className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-muted-foreground mb-1">
              Official Verification Token (If issued by NSUT)
            </label>
            <input
              type="text"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="Token or one-time code"
              className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-1 focus:ring-primary font-mono"
            />
          </div>

          <button
            type="submit"
            disabled={loading || !collegeId}
            className="w-full py-2.5 rounded-lg bg-primary text-primary-foreground font-semibold text-sm hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading ? "Verifying..." : "Verify & Generate Anonymous Identity"}
            <ArrowRight className="h-4 w-4" />
          </button>
        </form>

        <div className="p-3 bg-secondary/50 rounded-lg border border-border text-[11px] text-muted-foreground leading-relaxed">
          <strong className="text-foreground">Privacy Guarantee:</strong> Your real college ID and email will never be exposed in public chats, messages, or reactions. Only authorized university disciplinary processes can resolve your identity under immutable audit logging.
        </div>
      </div>
    </div>
  );
}
