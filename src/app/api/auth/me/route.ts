import { NextResponse } from "next/server";
import { getSessionUser, sanitizeUserProfile } from "@/lib/auth/session";

export async function GET() {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json(
        { error: "Authenticated verified user is required" },
        { status: 401 }
      );
    }

    return NextResponse.json(sanitizeUserProfile(user));
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Authentication error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
