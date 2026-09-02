"use client";

import { useState } from "react";
import { MessageDTO } from "@/lib/types";
import { MessageSquare, Smile, Flag, Trash2, User } from "lucide-react";
import { ReportModal } from "./ReportModal";
import clsx from "clsx";

interface MessageItemProps {
  message: MessageDTO;
  onReply: (message: MessageDTO) => void;
  onDelete: (messageId: string) => void;
  onReactionToggle: (messageId: string, reaction: string) => void;
  isStaff: boolean;
}

const EMOJI_MAP: Record<string, string> = {
  like: "👍",
  love: "❤️",
  laugh: "😂",
  wow: "😮",
  sad: "😢",
  angry: "😡",
};

export function MessageItem({
  message,
  onReply,
  onDelete,
  onReactionToggle,
  isStaff,
}: MessageItemProps) {
  const [showPicker, setShowPicker] = useState(false);
  const [isReportOpen, setIsReportOpen] = useState(false);
  const [reportSuccess, setReportSuccess] = useState(false);

  const formattedTime = new Date(message.createdAt).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div
      className={clsx(
        "group relative flex gap-3 p-3 rounded-lg hover:bg-secondary/40 transition-colors",
        message.isSender && "bg-secondary/20"
      )}
    >
      {/* Avatar */}
      <div className="h-8 w-8 shrink-0 rounded-full bg-accent flex items-center justify-center text-xs font-bold text-foreground border border-border/60">
        {message.sender.displayName.slice(9, 11) || <User className="h-4 w-4" />}
      </div>

      {/* Main message content */}
      <div className="flex-1 min-w-0">
        {/* Header */}
        <div className="flex items-center gap-2 mb-1">
          <span className="text-xs font-bold text-foreground truncate">
            {message.sender.displayName}
          </span>
          <span className="text-[10px] text-muted-foreground">
            {formattedTime}
          </span>
          {message.isSender && (
            <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.2 rounded border border-primary/20">
              You
            </span>
          )}
        </div>

        {/* Text */}
        <p className="text-sm text-foreground/90 whitespace-pre-wrap break-words leading-relaxed">
          {message.content}
        </p>

        {/* Reactions List */}
        {message.reactions.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2">
            {message.reactions.map((rx) => (
              <button
                key={rx.reaction}
                onClick={() => onReactionToggle(message.id, rx.reaction)}
                className={clsx(
                  "flex items-center gap-1 px-2 py-0.5 rounded-full text-xs border transition-colors",
                  rx.hasReacted
                    ? "bg-primary/20 border-primary/40 text-foreground"
                    : "bg-secondary/60 border-border text-muted-foreground hover:bg-secondary"
                )}
              >
                <span>{EMOJI_MAP[rx.reaction] || rx.reaction}</span>
                <span className="text-[11px] font-semibold">{rx.count}</span>
              </button>
            ))}
          </div>
        )}

        {/* Reply count */}
        {message.replyCount > 0 && (
          <button
            onClick={() => onReply(message)}
            className="flex items-center gap-1.5 mt-2 text-xs font-medium text-primary hover:underline"
          >
            <MessageSquare className="h-3 w-3" />
            <span>
              {message.replyCount} {message.replyCount === 1 ? "reply" : "replies"}
            </span>
          </button>
        )}

        {reportSuccess && (
          <span className="text-[11px] text-emerald-400 mt-1 block">
            Report submitted for review.
          </span>
        )}
      </div>

      {/* Floating Actions on Hover */}
      <div className="opacity-0 group-hover:opacity-100 transition-opacity absolute top-2 right-2 flex items-center gap-1 bg-card border border-border shadow-md rounded-md p-1">
        {/* Reaction picker trigger */}
        <div className="relative">
          <button
            onClick={() => setShowPicker((prev) => !prev)}
            title="React"
            className="p-1 rounded text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
          >
            <Smile className="h-3.5 w-3.5" />
          </button>

          {showPicker && (
            <div className="absolute right-0 bottom-full mb-1 flex gap-1 bg-card border border-border shadow-lg rounded-md p-1 z-20">
              {Object.entries(EMOJI_MAP).map(([key, emoji]) => (
                <button
                  key={key}
                  onClick={() => {
                    onReactionToggle(message.id, key);
                    setShowPicker(false);
                  }}
                  className="p-1.5 hover:bg-secondary rounded text-sm transition-transform active:scale-125"
                >
                  {emoji}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Reply button */}
        <button
          onClick={() => onReply(message)}
          title="Reply"
          className="p-1 rounded text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
        >
          <MessageSquare className="h-3.5 w-3.5" />
        </button>

        {/* Report button */}
        <button
          onClick={() => setIsReportOpen(true)}
          title="Report message"
          className="p-1 rounded text-muted-foreground hover:bg-secondary hover:text-destructive transition-colors"
        >
          <Flag className="h-3.5 w-3.5" />
        </button>

        {/* Delete (if author or staff) */}
        {(message.isSender || isStaff) && (
          <button
            onClick={() => onDelete(message.id)}
            title="Delete message"
            className="p-1 rounded text-muted-foreground hover:bg-secondary hover:text-destructive transition-colors"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      <ReportModal
        messageId={message.id}
        isOpen={isReportOpen}
        onClose={() => setIsReportOpen(false)}
        onReportSubmitted={() => setReportSuccess(true)}
      />
    </div>
  );
}
