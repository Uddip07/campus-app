"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { MessageDTO, UserSessionProfile } from "@/lib/types";
import { createClient } from "@/lib/supabase/client";
import { ConnectionStatus, ConnectionState } from "./ConnectionStatus";
import { MessageItem } from "./MessageItem";
import { MessageInput } from "./MessageInput";
import { MessageSquare, AlertCircle, Loader2 } from "lucide-react";

interface ChatContainerProps {
  roomId: string;
  roomName: string;
  currentUser: UserSessionProfile;
}

export function ChatContainer({
  roomId,
  roomName,
  currentUser,
}: ChatContainerProps) {
  const [messages, setMessages] = useState<MessageDTO[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [connectionState, setConnectionState] = useState<ConnectionState>("connecting");
  const [replyingTo, setReplyingTo] = useState<MessageDTO | null>(null);

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const isInitialLoad = useRef(true);

  // Fetch initial messages (latest 50)
  const fetchInitialMessages = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/rooms/${roomId}/messages?limit=50`);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to load messages");
      }
      const data = await res.json();
      // Reverse messages so newest are at the bottom
      const ordered = [...data.messages].reverse();
      setMessages(ordered);
      setNextCursor(data.nextCursor);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error loading messages");
    } finally {
      setLoading(false);
    }
  }, [roomId]);

  // Load older messages (cursor pagination when scrolling up)
  const loadOlderMessages = async () => {
    if (!nextCursor || loadingMore) return;
    setLoadingMore(true);

    const scrollContainer = scrollContainerRef.current;
    const prevScrollHeight = scrollContainer?.scrollHeight || 0;

    try {
      const res = await fetch(
        `/api/rooms/${roomId}/messages?before=${encodeURIComponent(nextCursor)}&limit=50`
      );
      if (res.ok) {
        const data = await res.json();
        const older = [...data.messages].reverse();
        setMessages((prev) => [...older, ...prev]);
        setNextCursor(data.nextCursor);

        // Preserve scroll position
        requestAnimationFrame(() => {
          if (scrollContainer) {
            scrollContainer.scrollTop = scrollContainer.scrollHeight - prevScrollHeight;
          }
        });
      }
    } catch (err) {
      console.error("Failed to load older messages:", err);
    } finally {
      setLoadingMore(false);
    }
  };

  useEffect(() => {
    isInitialLoad.current = true;
    fetchInitialMessages();
  }, [fetchInitialMessages]);

  // Realtime subscription via Supabase Realtime
  useEffect(() => {
    const supabase = createClient();
    if (!supabase) {
      setConnectionState("disconnected");
      return;
    }

    setConnectionState("connecting");
    const channel = supabase.channel(`room:${roomId}`);

    channel
      .on("broadcast", { event: "new_message" }, ({ payload }) => {
        const incoming: MessageDTO = payload;
        setMessages((prev) => {
          // Avoid duplicate insertion
          if (prev.some((m) => m.id === incoming.id)) {
            return prev;
          }
          const isSender = incoming.sender.displayName === currentUser.anonymousName;
          return [...prev, { ...incoming, isSender }];
        });
      })
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          setConnectionState("connected");
        } else if (status === "CHANNEL_ERROR") {
          setConnectionState("disconnected");
        } else if (status === "TIMED_OUT") {
          setConnectionState("reconnecting");
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [roomId, currentUser.anonymousName]);

  // Auto-scroll to bottom on initial load and new messages
  useEffect(() => {
    if (loading) return;
    if (isInitialLoad.current && scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight;
      isInitialLoad.current = false;
    }
  }, [messages, loading]);

  // Scroll handler for cursor pagination
  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    if (e.currentTarget.scrollTop === 0 && nextCursor && !loadingMore) {
      loadOlderMessages();
    }
  };

  const handleSendMessage = async (content: string, replyToId?: string | null) => {
    const res = await fetch(`/api/rooms/${roomId}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content, replyToId }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || "Failed to send message");
    }

    const createdMessage: MessageDTO = await res.json();
    setMessages((prev) => {
      if (prev.some((m) => m.id === createdMessage.id)) return prev;
      return [...prev, createdMessage];
    });

    // Scroll to bottom
    setTimeout(() => {
      if (scrollContainerRef.current) {
        scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight;
      }
    }, 50);
  };

  const handleDeleteMessage = async (messageId: string) => {
    try {
      const res = await fetch(`/api/messages/${messageId}`, { method: "DELETE" });
      if (res.ok) {
        setMessages((prev) => prev.filter((m) => m.id !== messageId));
      }
    } catch (err) {
      console.error("Failed to delete message:", err);
    }
  };

  const handleReactionToggle = async (messageId: string, reaction: string) => {
    try {
      const res = await fetch(`/api/messages/${messageId}/reactions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reaction }),
      });
      if (res.ok) {
        const { reacted } = await res.json();
        setMessages((prev) =>
          prev.map((msg) => {
            if (msg.id !== messageId) return msg;

            const existingReaction = msg.reactions.find((r) => r.reaction === reaction);
            let updatedReactions = [...msg.reactions];

            if (reacted) {
              if (existingReaction) {
                updatedReactions = updatedReactions.map((r) =>
                  r.reaction === reaction
                    ? { ...r, count: r.count + 1, hasReacted: true }
                    : r
                );
              } else {
                updatedReactions.push({ reaction, count: 1, hasReacted: true });
              }
            } else {
              if (existingReaction) {
                if (existingReaction.count <= 1) {
                  updatedReactions = updatedReactions.filter((r) => r.reaction !== reaction);
                } else {
                  updatedReactions = updatedReactions.map((r) =>
                    r.reaction === reaction
                      ? { ...r, count: r.count - 1, hasReacted: false }
                      : r
                  );
                }
              }
            }

            return { ...msg, reactions: updatedReactions };
          })
        );
      }
    } catch (err) {
      console.error("Failed to toggle reaction:", err);
    }
  };

  const isStaff = ["moderator", "admin", "super_admin"].includes(currentUser.role);

  return (
    <div className="flex flex-col h-[calc(100vh-3.5rem)] max-w-4xl mx-auto w-full bg-card/40 border-x border-border/60">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border/80 bg-card/80 backdrop-blur">
        <div>
          <h1 className="text-base font-bold text-foreground flex items-center gap-2">
            <span>{roomName}</span>
          </h1>
          <p className="text-xs text-muted-foreground">
            Pseudonymous student room · Server-verified NSUT community
          </p>
        </div>
      </div>

      <ConnectionStatus status={connectionState} />

      {/* Messages Scroll Area */}
      <div
        ref={scrollContainerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto p-4 space-y-3"
      >
        {loadingMore && (
          <div className="flex justify-center py-2">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          </div>
        )}

        {/* Loading Skeletons */}
        {loading && (
          <div className="space-y-4 py-4">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="flex gap-3 animate-pulse">
                <div className="h-8 w-8 rounded-full bg-secondary" />
                <div className="space-y-2 flex-1">
                  <div className="h-3 w-28 bg-secondary rounded" />
                  <div className="h-4 w-3/4 bg-secondary/80 rounded" />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Error State */}
        {error && !loading && (
          <div className="flex flex-col items-center justify-center h-48 text-center p-4">
            <AlertCircle className="h-8 w-8 text-destructive mb-2" />
            <p className="text-sm font-semibold text-foreground mb-1">{error}</p>
            <button
              onClick={fetchInitialMessages}
              className="text-xs text-primary underline"
            >
              Retry
            </button>
          </div>
        )}

        {/* Truthful Empty State */}
        {!loading && !error && messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-64 text-center p-4">
            <div className="h-12 w-12 rounded-full bg-secondary flex items-center justify-center text-muted-foreground mb-3">
              <MessageSquare className="h-6 w-6" />
            </div>
            <h3 className="text-sm font-semibold text-foreground mb-1">
              No messages yet.
            </h3>
            <p className="text-xs text-muted-foreground max-w-xs">
              Be the first to post an anonymous message in this room.
            </p>
          </div>
        )}

        {/* Message Items */}
        {!loading &&
          !error &&
          messages.map((msg) => (
            <MessageItem
              key={msg.id}
              message={msg}
              onReply={(m) => setReplyingTo(m)}
              onDelete={handleDeleteMessage}
              onReactionToggle={handleReactionToggle}
              isStaff={isStaff}
            />
          ))}
      </div>

      {/* Message Input */}
      <MessageInput
        onSendMessage={handleSendMessage}
        replyingTo={replyingTo}
        onCancelReply={() => setReplyingTo(null)}
        disabled={currentUser.isMutedOrBanned}
      />
    </div>
  );
}
