import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getSupabaseConfig } from "../env";

export function createServerSupabaseClient() {
  const { url, publishableKey, isConfigured } = getSupabaseConfig();

  if (!isConfigured) {
    return null;
  }

  const cookieStore = cookies();

  const COOKIE_MAX_AGE = 400 * 24 * 60 * 60; // 400 days persistent

  return createServerClient(url, publishableKey, {
    cookieOptions: {
      path: "/",
      sameSite: "lax",
      maxAge: COOKIE_MAX_AGE,
    },
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(
        cookiesToSet: Array<{
          name: string;
          value: string;
          options?: Parameters<typeof cookieStore.set>[2];
        }>
      ) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, {
              path: "/",
              sameSite: "lax",
              maxAge: options?.maxAge !== undefined ? options.maxAge : COOKIE_MAX_AGE,
              ...options,
            })
          );
        } catch {
          // Can be ignored if called from a Server Component
        }
      },
    },
  });
}
