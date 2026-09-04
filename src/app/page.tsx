import { redirect } from "next/navigation";
import { getAuthenticatedAuthUser, getSessionUser } from "@/lib/auth/session";

export default async function HomePage() {
  let authUser = null;
  let user = null;

  try {
    authUser = await getAuthenticatedAuthUser();
    if (authUser) {
      user = await getSessionUser();
    }
  } catch {
    // Database or supabase unconfigured
  }

  if (user) {
    redirect("/chat");
  }

  if (authUser) {
    redirect("/verify");
  }

  redirect("/login");
}
