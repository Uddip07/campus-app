import { AnnouncementDTO } from "@/lib/types";
import { Pin, Paperclip, FileText, Calendar } from "lucide-react";
import clsx from "clsx";

interface AnnouncementCardProps {
  announcement: AnnouncementDTO;
}

export function AnnouncementCard({ announcement }: AnnouncementCardProps) {
  const publishedDate = announcement.publishedAt
    ? new Date(announcement.publishedAt).toLocaleDateString([], {
        year: "numeric",
        month: "short",
        day: "numeric",
      })
    : "Draft";

  return (
    <article
      className={clsx(
        "p-5 rounded-lg border transition-colors relative",
        announcement.isPinned
          ? "bg-secondary/40 border-primary/30 shadow-sm"
          : "bg-card border-border/80"
      )}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="flex flex-wrap items-center gap-2">
          {announcement.isPinned && (
            <span className="flex items-center gap-1 text-[11px] font-bold text-amber-400 bg-amber-950/60 border border-amber-800/40 px-2 py-0.5 rounded-full">
              <Pin className="h-3 w-3 fill-amber-400" />
              Pinned
            </span>
          )}

          <span className="text-[11px] font-medium text-muted-foreground bg-secondary px-2 py-0.5 rounded-md border border-border">
            {announcement.audienceType === "all" && "All College"}
            {announcement.audienceType === "cohort" &&
              `${announcement.cohortYear ?? ""} Batch`}
            {announcement.audienceType === "alumni" && "Alumni"}
          </span>
        </div>

        <div className="flex items-center gap-1.5 text-xs text-muted-foreground shrink-0">
          <Calendar className="h-3.5 w-3.5" />
          <span>{publishedDate}</span>
        </div>
      </div>

      {/* Title & Body */}
      <h2 className="text-base font-bold text-foreground mb-2 leading-snug">
        {announcement.title}
      </h2>

      <p className="text-sm text-foreground/80 whitespace-pre-wrap break-words leading-relaxed mb-4">
        {announcement.content}
      </p>

      {/* Attachments */}
      {announcement.attachments.length > 0 && (
        <div className="border-t border-border/60 pt-3 space-y-1.5">
          <span className="text-xs font-semibold text-muted-foreground flex items-center gap-1">
            <Paperclip className="h-3.5 w-3.5" />
            Attachments ({announcement.attachments.length})
          </span>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-1">
            {announcement.attachments.map((att) => (
              <a
                key={att.id}
                href={att.downloadUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 p-2 rounded-md bg-secondary/50 border border-border hover:bg-secondary text-xs text-foreground transition-colors group"
              >
                <FileText className="h-4 w-4 text-primary shrink-0" />
                <span className="truncate flex-1 font-medium group-hover:underline">
                  {att.fileName}
                </span>
                <span className="text-[10px] text-muted-foreground shrink-0">
                  {(att.fileSize / 1024).toFixed(0)} KB
                </span>
              </a>
            ))}
          </div>
        </div>
      )}
    </article>
  );
}
