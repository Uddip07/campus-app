"use client";

import { useState, useEffect } from "react";
import { UserSessionProfile, AdminStatsDTO, ReportDTO, AuditLogDTO } from "@/lib/types";
import {
  Shield,
  Users,
  GraduationCap,
  AlertTriangle,
  Bell,
  CheckCircle2,
  Lock,
  Search,
  FileText,
  Trash2,
  VolumeX,
  UserX,
} from "lucide-react";
import clsx from "clsx";

interface AdminDashboardProps {
  currentUser: UserSessionProfile;
}

export function AdminDashboard({ currentUser }: AdminDashboardProps) {
  const [stats, setStats] = useState<AdminStatsDTO | null>(null);
  const [reports, setReports] = useState<ReportDTO[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogDTO[]>([]);
  const [activeTab, setActiveTab] = useState<"moderation" | "announcements" | "resolution" | "audit">("moderation");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Announcement form state
  const [annTitle, setAnnTitle] = useState("");
  const [annContent, setAnnContent] = useState("");
  const [annAudience, setAnnAudience] = useState<"all" | "cohort" | "alumni">("all");
  const [annPinned, setAnnPinned] = useState(false);
  const [annSubmitting, setAnnSubmitting] = useState(false);
  const [annSuccess, setAnnSuccess] = useState(false);

  // Identity resolution form state (super admin)
  const [resolveName, setResolveName] = useState("");
  const [resolveReason, setResolveReason] = useState("");
  const [resolveSubmitting, setResolveSubmitting] = useState(false);
  const [resolvedResult, setResolvedResult] = useState<any | null>(null);
  const [resolveError, setResolveError] = useState<string | null>(null);

  const isSuperAdmin = currentUser.role === "super_admin";
  const isAdminOrSuper = ["admin", "super_admin"].includes(currentUser.role);

  // Load stats and reports
  const refreshData = async () => {
    setLoading(true);
    setError(null);
    try {
      const statsRes = await fetch("/api/admin/stats");
      if (statsRes.ok) {
        const data = await statsRes.json();
        setStats(data.stats);
      }

      const reportsRes = await fetch("/api/admin/reports");
      if (reportsRes.ok) {
        const data = await reportsRes.json();
        setReports(data.reports);
      }

      if (isSuperAdmin) {
        const auditRes = await fetch("/api/admin/audit");
        if (auditRes.ok) {
          const data = await auditRes.json();
          setAuditLogs(data.logs);
        }
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error loading dashboard");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshData();
  }, []);

  const handleReportAction = async (reportId: string, action: string) => {
    try {
      const res = await fetch(`/api/admin/reports/${reportId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });

      if (res.ok) {
        setReports((prev) => prev.filter((r) => r.id !== reportId));
        if (stats) {
          setStats({ ...stats, pendingReports: Math.max(0, stats.pendingReports - 1) });
        }
      }
    } catch (err) {
      console.error("Action error:", err);
    }
  };

  const handleCreateAnnouncement = async (e: React.FormEvent) => {
    e.preventDefault();
    setAnnSubmitting(true);
    setAnnSuccess(false);

    try {
      const res = await fetch("/api/admin/announcements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: annTitle,
          content: annContent,
          audienceType: annAudience,
          isPinned: annPinned,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to create announcement");
      }

      setAnnTitle("");
      setAnnContent("");
      setAnnPinned(false);
      setAnnSuccess(true);
      if (stats) {
        setStats({ ...stats, totalAnnouncements: stats.totalAnnouncements + 1 });
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error creating announcement");
    } finally {
      setAnnSubmitting(false);
    }
  };

  const handleResolveIdentity = async (e: React.FormEvent) => {
    e.preventDefault();
    setResolveSubmitting(true);
    setResolveError(null);
    setResolvedResult(null);

    try {
      const res = await fetch("/api/admin/resolve-identity", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          displayName: resolveName.trim(),
          reason: resolveReason.trim(),
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Resolution failed");
      }

      const data = await res.json();
      setResolvedResult(data.resolved);
      refreshData();
    } catch (err: unknown) {
      setResolveError(err instanceof Error ? err.message : "Resolution error");
    } finally {
      setResolveSubmitting(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/80 pb-4">
        <div>
          <h1 className="text-xl font-extrabold tracking-tight text-foreground flex items-center gap-2">
            <Shield className="h-5 w-5 text-amber-400" />
            Staff & Moderation Dashboard
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Role: <span className="font-semibold uppercase text-foreground">{currentUser.role}</span> · Audited administrative boundary
          </p>
        </div>
      </div>

      {/* Metric Cards (Real PostgreSQL counts - Zero Mock Data) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-4 rounded-lg bg-card border border-border">
          <div className="flex items-center justify-between text-muted-foreground mb-1">
            <span className="text-xs font-semibold">Students</span>
            <Users className="h-4 w-4" />
          </div>
          <div className="text-2xl font-black text-foreground">
            {stats ? stats.totalStudents : 0}
          </div>
        </div>

        <div className="p-4 rounded-lg bg-card border border-border">
          <div className="flex items-center justify-between text-muted-foreground mb-1">
            <span className="text-xs font-semibold">Alumni</span>
            <GraduationCap className="h-4 w-4" />
          </div>
          <div className="text-2xl font-black text-foreground">
            {stats ? stats.totalAlumni : 0}
          </div>
        </div>

        <div className="p-4 rounded-lg bg-card border border-border">
          <div className="flex items-center justify-between text-muted-foreground mb-1">
            <span className="text-xs font-semibold">Pending Reports</span>
            <AlertTriangle className="h-4 w-4 text-destructive" />
          </div>
          <div className="text-2xl font-black text-foreground">
            {stats ? stats.pendingReports : 0}
          </div>
        </div>

        <div className="p-4 rounded-lg bg-card border border-border">
          <div className="flex items-center justify-between text-muted-foreground mb-1">
            <span className="text-xs font-semibold">Announcements</span>
            <Bell className="h-4 w-4 text-primary" />
          </div>
          <div className="text-2xl font-black text-foreground">
            {stats ? stats.totalAnnouncements : 0}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-border/80">
        <button
          onClick={() => setActiveTab("moderation")}
          className={clsx(
            "px-4 py-2 text-xs font-bold border-b-2 transition-colors",
            activeTab === "moderation"
              ? "border-primary text-foreground"
              : "border-transparent text-muted-foreground hover:text-foreground"
          )}
        >
          Moderation Queue ({reports.length})
        </button>

        {isAdminOrSuper && (
          <button
            onClick={() => setActiveTab("announcements")}
            className={clsx(
              "px-4 py-2 text-xs font-bold border-b-2 transition-colors",
              activeTab === "announcements"
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            Publish Announcement
          </button>
        )}

        {isSuperAdmin && (
          <>
            <button
              onClick={() => setActiveTab("resolution")}
              className={clsx(
                "px-4 py-2 text-xs font-bold border-b-2 transition-colors flex items-center gap-1.5",
                activeTab === "resolution"
                  ? "border-amber-400 text-amber-400"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              <Lock className="h-3.5 w-3.5" />
              Identity Resolution
            </button>
            <button
              onClick={() => setActiveTab("audit")}
              className={clsx(
                "px-4 py-2 text-xs font-bold border-b-2 transition-colors",
                activeTab === "audit"
                  ? "border-primary text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              Audit Trail
            </button>
          </>
        )}
      </div>

      {/* Moderation Tab */}
      {activeTab === "moderation" && (
        <div className="space-y-4">
          <h2 className="text-sm font-bold text-foreground">
            Pending Student Reports
          </h2>

          {reports.length === 0 && (
            <div className="flex flex-col items-center justify-center h-48 border border-dashed border-border rounded-lg p-6 bg-card/40">
              <CheckCircle2 className="h-8 w-8 text-emerald-500 mb-2" />
              <p className="text-sm font-semibold text-foreground">No pending reports.</p>
              <p className="text-xs text-muted-foreground">All flagged content has been resolved.</p>
            </div>
          )}

          {reports.map((report) => (
            <div
              key={report.id}
              className="p-4 rounded-lg bg-card border border-border space-y-3"
            >
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span className="font-semibold text-destructive uppercase">
                  Reason: {report.reason}
                </span>
                <span>Reported by: {report.reporterAnonymousName}</span>
              </div>

              {/* Message snippet */}
              <div className="p-3 bg-secondary/50 rounded border border-border/80 text-sm">
                <span className="text-xs font-bold text-foreground block mb-1">
                  Author: {report.messageSenderAnonymousName}
                </span>
                <p className="text-foreground/90 whitespace-pre-wrap">{report.messageContent}</p>
              </div>

              {report.description && (
                <p className="text-xs text-muted-foreground italic">
                  Note: "{report.description}"
                </p>
              )}

              {/* Action Buttons */}
              <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-border/60">
                <button
                  onClick={() => handleReportAction(report.id, "dismiss")}
                  className="px-3 py-1.5 rounded bg-secondary hover:bg-secondary/80 text-xs font-medium text-foreground transition-colors"
                >
                  Dismiss Report
                </button>
                <button
                  onClick={() => handleReportAction(report.id, "remove_message")}
                  className="px-3 py-1.5 rounded bg-destructive/20 hover:bg-destructive/30 text-destructive text-xs font-medium transition-colors flex items-center gap-1"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Remove Message
                </button>
                <button
                  onClick={() => handleReportAction(report.id, "mute")}
                  className="px-3 py-1.5 rounded bg-amber-950/40 border border-amber-800/40 hover:bg-amber-950/60 text-amber-300 text-xs font-medium transition-colors flex items-center gap-1"
                >
                  <VolumeX className="h-3.5 w-3.5" />
                  Mute User (24h)
                </button>
                <button
                  onClick={() => handleReportAction(report.id, "temp_ban")}
                  className="px-3 py-1.5 rounded bg-amber-950/40 border border-amber-800/40 hover:bg-amber-950/60 text-amber-300 text-xs font-medium transition-colors flex items-center gap-1"
                >
                  <UserX className="h-3.5 w-3.5" />
                  Temp Ban (24h)
                </button>
                <button
                  onClick={() => handleReportAction(report.id, "permanent_ban")}
                  className="px-3 py-1.5 rounded bg-destructive text-destructive-foreground hover:bg-destructive/90 text-xs font-medium transition-colors flex items-center gap-1"
                >
                  <UserX className="h-3.5 w-3.5" />
                  Permanent Ban
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Publish Announcement Tab */}
      {activeTab === "announcements" && isAdminOrSuper && (
        <div className="p-6 bg-card border border-border rounded-lg space-y-4 max-w-2xl">
          <h2 className="text-base font-bold text-foreground">
            Publish Official Announcement
          </h2>

          {annSuccess && (
            <div className="p-3 bg-emerald-950/40 border border-emerald-800/50 rounded text-xs text-emerald-300">
              Announcement published successfully!
            </div>
          )}

          <form onSubmit={handleCreateAnnouncement} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-muted-foreground mb-1">
                Announcement Title
              </label>
              <input
                type="text"
                value={annTitle}
                onChange={(e) => setAnnTitle(e.target.value)}
                required
                maxLength={200}
                placeholder="e.g. End-Semester Examination Schedule"
                className="w-full bg-secondary border border-border rounded-md px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-muted-foreground mb-1">
                Audience
              </label>
              <select
                value={annAudience}
                onChange={(e) => setAnnAudience(e.target.value as any)}
                className="w-full bg-secondary border border-border rounded-md px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <option value="all">All College</option>
                <option value="cohort">{currentUser.cohort} Batch Only</option>
                <option value="alumni">Alumni Only</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-muted-foreground mb-1">
                Content
              </label>
              <textarea
                value={annContent}
                onChange={(e) => setAnnContent(e.target.value)}
                required
                rows={5}
                placeholder="Write the full announcement text..."
                className="w-full bg-secondary border border-border rounded-md px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary resize-none"
              />
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="pinToggle"
                checked={annPinned}
                onChange={(e) => setAnnPinned(e.target.checked)}
                className="rounded border-border bg-secondary"
              />
              <label htmlFor="pinToggle" className="text-xs font-semibold text-foreground">
                Pin this announcement to top of feed
              </label>
            </div>

            <button
              type="submit"
              disabled={annSubmitting}
              className="px-4 py-2 rounded-md bg-primary text-primary-foreground font-semibold text-sm hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {annSubmitting ? "Publishing..." : "Publish Announcement"}
            </button>
          </form>
        </div>
      )}

      {/* Identity Resolution Tab (Super Admin Only) */}
      {activeTab === "resolution" && isSuperAdmin && (
        <div className="p-6 bg-card border border-amber-900/40 rounded-lg space-y-4 max-w-2xl">
          <div className="flex items-center gap-2 text-amber-400">
            <Lock className="h-5 w-5" />
            <h2 className="text-base font-bold">Privileged Identity Resolution</h2>
          </div>

          <p className="text-xs text-muted-foreground leading-relaxed">
            This operation reveals the real NSUT College ID and institutional email of an anonymous student.
            <strong className="text-amber-400"> Every resolution creates an indelible audit record.</strong> Use only for official disciplinary or legal investigations.
          </p>

          {resolveError && (
            <div className="p-3 bg-destructive/20 border border-destructive/40 rounded text-xs text-red-200">
              {resolveError}
            </div>
          )}

          <form onSubmit={handleResolveIdentity} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-muted-foreground mb-1">
                Anonymous Display Name
              </label>
              <input
                type="text"
                value={resolveName}
                onChange={(e) => setResolveName(e.target.value)}
                required
                placeholder="e.g. AnonymousCosmicFox42"
                className="w-full bg-secondary border border-border rounded-md px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-amber-400 font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-muted-foreground mb-1">
                Mandatory Legitimate Reason (min 10 chars)
              </label>
              <textarea
                value={resolveReason}
                onChange={(e) => setResolveReason(e.target.value)}
                required
                minLength={10}
                rows={3}
                placeholder="State the official investigation rationale or case reference..."
                className="w-full bg-secondary border border-border rounded-md px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-amber-400 resize-none"
              />
            </div>

            <button
              type="submit"
              disabled={resolveSubmitting || resolveReason.length < 10}
              className="px-4 py-2 rounded-md bg-amber-500 text-black font-bold text-sm hover:bg-amber-400 transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              <Search className="h-4 w-4" />
              {resolveSubmitting ? "Resolving..." : "Resolve Identity & Log Audit"}
            </button>
          </form>

          {/* Resolved Result Card */}
          {resolvedResult && (
            <div className="mt-4 p-4 rounded-lg bg-secondary/80 border border-amber-600/60 space-y-2 animate-in fade-in">
              <span className="text-xs font-bold text-amber-400 uppercase tracking-wider block">
                Official Identity Record
              </span>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="text-muted-foreground">College ID:</span>
                  <p className="font-mono font-bold text-foreground">{resolvedResult.collegeId}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">College Email:</span>
                  <p className="font-mono font-bold text-foreground">{resolvedResult.collegeEmail}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Roll Number:</span>
                  <p className="font-bold text-foreground">{resolvedResult.rollNumber}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Program:</span>
                  <p className="font-bold text-foreground">{resolvedResult.programCode} ({resolvedResult.enrollmentYear})</p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Audit Log Tab (Super Admin Only) */}
      {activeTab === "audit" && isSuperAdmin && (
        <div className="space-y-4">
          <h2 className="text-sm font-bold text-foreground flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Immutable Audit Trail
          </h2>

          {auditLogs.length === 0 ? (
            <div className="p-6 border border-dashed border-border rounded-lg text-center text-xs text-muted-foreground">
              No audit logs recorded yet.
            </div>
          ) : (
            <div className="overflow-x-auto border border-border rounded-lg">
              <table className="w-full text-left text-xs">
                <thead className="bg-secondary/60 text-muted-foreground uppercase text-[10px]">
                  <tr>
                    <th className="p-3">Timestamp</th>
                    <th className="p-3">Actor</th>
                    <th className="p-3">Action</th>
                    <th className="p-3">Target</th>
                    <th className="p-3">Metadata</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {auditLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-secondary/20">
                      <td className="p-3 font-mono text-muted-foreground whitespace-nowrap">
                        {new Date(log.createdAt).toLocaleString()}
                      </td>
                      <td className="p-3 font-bold text-foreground whitespace-nowrap">
                        {log.actorAnonymousName}
                      </td>
                      <td className="p-3">
                        <span className="px-2 py-0.5 rounded bg-accent text-[11px] font-semibold text-foreground">
                          {log.action}
                        </span>
                      </td>
                      <td className="p-3 text-muted-foreground font-mono">
                        {log.targetType}
                      </td>
                      <td className="p-3 text-muted-foreground max-w-xs truncate">
                        {JSON.stringify(log.metadata)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
