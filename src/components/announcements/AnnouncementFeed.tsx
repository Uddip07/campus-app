"use client";

import { useState, useEffect } from "react";
import { AnnouncementDTO, UserSessionProfile } from "@/lib/types";
import { AnnouncementCard } from "./AnnouncementCard";
import { Bell, AlertCircle } from "lucide-react";
import clsx from "clsx";

interface AnnouncementFeedProps {
  currentUser: UserSessionProfile;
}

export function AnnouncementFeed({ currentUser }: AnnouncementFeedProps) {
  const [announcements, setAnnouncements] = useState<AnnouncementDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "cohort" | "alumni" | "everything">("everything");

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/announcements");
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || "Failed to load announcements");
        }
        const data = await res.json();
        setAnnouncements(data.announcements);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "Error fetching announcements");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const filtered = announcements.filter((a) => {
    if (filter === "everything") return true;
    return a.audienceType === filter;
  });

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 w-full space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/80 pb-4">
        <div>
          <h1 className="text-xl font-extrabold tracking-tight text-foreground flex items-center gap-2">
            <Bell className="h-5 w-5 text-primary" />
            Official Announcements
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Verified updates from NSUT administration and student coordinators
          </p>
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-1.5 bg-secondary/60 p-1 rounded-md border border-border text-xs">
          <button
            onClick={() => setFilter("everything")}
            className={clsx(
              "px-2.5 py-1 rounded font-medium transition-colors",
              filter === "everything"
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            All Updates
          </button>
          <button
            onClick={() => setFilter("all")}
            className={clsx(
              "px-2.5 py-1 rounded font-medium transition-colors",
              filter === "all"
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            College Wide
          </button>
          <button
            onClick={() => setFilter("cohort")}
            className={clsx(
              "px-2.5 py-1 rounded font-medium transition-colors",
              filter === "cohort"
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {currentUser.cohort} Batch
          </button>
          {currentUser.role === "alumni" && (
            <button
              onClick={() => setFilter("alumni")}
              className={clsx(
                "px-2.5 py-1 rounded font-medium transition-colors",
                filter === "alumni"
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              Alumni
            </button>
          )}
        </div>
      </div>

      {/* Loading Skeletons */}
      {loading && (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="p-5 rounded-lg border border-border bg-card animate-pulse space-y-3"
            >
              <div className="h-4 w-1/4 bg-secondary rounded" />
              <div className="h-5 w-3/4 bg-secondary rounded" />
              <div className="h-16 bg-secondary/50 rounded" />
            </div>
          ))}
        </div>
      )}

      {/* Error */}
      {error && !loading && (
        <div className="p-4 rounded-lg bg-destructive/20 border border-destructive/40 text-sm text-red-200 flex items-center gap-3">
          <AlertCircle className="h-5 w-5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Truthful Empty State */}
      {!loading && !error && filtered.length === 0 && (
        <div className="flex flex-col items-center justify-center h-64 text-center p-6 border border-dashed border-border rounded-lg bg-card/40">
          <div className="h-12 w-12 rounded-full bg-secondary flex items-center justify-center text-muted-foreground mb-3">
            <Bell className="h-6 w-6" />
          </div>
          <h3 className="text-sm font-semibold text-foreground mb-1">
            No announcements yet.
          </h3>
          <p className="text-xs text-muted-foreground max-w-xs">
            There are currently no active announcements published for this audience.
          </p>
        </div>
      )}

      {/* Announcements List */}
      {!loading && !error && filtered.length > 0 && (
        <div className="space-y-4">
          {filtered.map((a) => (
            <AnnouncementCard key={a.id} announcement={a} />
          ))}
        </div>
      )}
    </div>
  );
}
