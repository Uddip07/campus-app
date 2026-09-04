import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function POST() {
  try {
    const supabase = createServerSupabaseClient();
    if (supabase) {
      await supabase.auth.signOut();
    }
    const response = NextResponse.json({ success: true });
    response.cookies.set("campus_onboarded", "", { path: "/", maxAge: 0 });
    return response;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Logout error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
