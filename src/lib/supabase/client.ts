import { createBrowserClient } from "@supabase/ssr";
import { getSupabaseConfig } from "../env";

export function createClient() {
  const { url, anonKey, isConfigured } = getSupabaseConfig();
  if (!isConfigured) {
    // Return null or client that signals unconfigured state
    return null;
  }
  return createBrowserClient(url, anonKey);
}
