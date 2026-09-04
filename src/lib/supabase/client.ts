import { createBrowserClient } from "@supabase/ssr";
import { getSupabaseConfig } from "../env";

export function createClient() {
  const { url, publishableKey, isConfigured } = getSupabaseConfig();
  if (!isConfigured) {
    // Return null or client that signals unconfigured state
    return null;
  }
  return createBrowserClient(url, publishableKey, {
    cookieOptions: {
      path: "/",
      sameSite: "lax",
      maxAge: 400 * 24 * 60 * 60,
    },
  });
}
