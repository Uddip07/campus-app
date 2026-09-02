import { createClient } from "@supabase/supabase-js";
import { getSupabaseConfig } from "../env";
import { MessageDTO } from "../types";

/**
 * Broadcasts a persisted, sanitized message to connected room subscribers.
 * Delivery only — PostgreSQL is the source of truth.
 */
export async function broadcastNewMessage(
  roomId: string,
  message: MessageDTO
): Promise<void> {
  const { url, secretKey, isConfigured } = getSupabaseConfig();
  if (!isConfigured || !secretKey) {
    // In local dev without Supabase realtime configured, broadcast is skipped
    return;
  }

  try {
    const supabase = createClient(url, secretKey);
    const channel = supabase.channel(`room:${roomId}`);

    await channel.send({
      type: "broadcast",
      event: "new_message",
      payload: message,
    });

    await supabase.removeChannel(channel);
  } catch (err) {
    console.error("[Realtime] Error broadcasting message to room:", roomId, err);
  }
}
