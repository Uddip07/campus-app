"use client";

import { useState, useRef, useEffect } from "react";
import { Send, X } from "lucide-react";
import { MessageDTO } from "@/lib/types";

interface MessageInputProps {
  onSendMessage: (content: string, replyToId?: string | null) => Promise<void>;
  replyingTo: MessageDTO | null;
  onCancelReply: () => void;
  disabled?: boolean;
}

export function MessageInput({
  onSendMessage,
  replyingTo,
  onCancelReply,
  disabled = false,
}: MessageInputProps) {
  const [content, setContent] = useState("");
  const [sending, setSending] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (replyingTo && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [replyingTo]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleSend = async () => {
    const trimmed = content.trim();
    if (!trimmed || sending || disabled) return;

    setSending(true);
    try {
      await onSendMessage(trimmed, replyingTo?.id || null);
      setContent("");
      onCancelReply();
    } catch (err) {
      console.error("Failed to send:", err);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="border-t border-border/80 bg-card/60 backdrop-blur p-3">
      {/* Replying To Banner */}
      {replyingTo && (
        <div className="flex items-center justify-between bg-secondary/80 border border-border rounded-md px-3 py-1.5 mb-2 text-xs">
          <div className="flex items-center gap-2 truncate">
            <span className="text-muted-foreground font-medium">Replying to</span>
            <span className="font-bold text-foreground">
              {replyingTo.sender.displayName}
            </span>
            <span className="text-muted-foreground truncate max-w-xs">
              &ldquo;{replyingTo.content}&rdquo;
            </span>
          </div>
          <button
            onClick={onCancelReply}
            className="text-muted-foreground hover:text-foreground ml-2"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Input Row */}
      <div className="flex items-end gap-2">
        <textarea
          ref={textareaRef}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={
            disabled
              ? "Posting is disabled (muted or banned)."
              : "Write an anonymous message... (Enter to send)"
          }
          disabled={disabled || sending}
          maxLength={4000}
          rows={1}
          className="flex-1 bg-secondary/50 border border-border rounded-md px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-1 focus:ring-primary resize-none disabled:opacity-50"
        />

        <button
          onClick={handleSend}
          disabled={!content.trim() || sending || disabled}
          className="p-2.5 rounded-md bg-primary text-primary-foreground hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
        >
          <Send className="h-4 w-4" />
        </button>
      </div>

      {/* Character count */}
      {content.length > 3000 && (
        <div className="text-right text-[10px] text-muted-foreground mt-1">
          {content.length} / 4000
        </div>
      )}
    </div>
  );
}
