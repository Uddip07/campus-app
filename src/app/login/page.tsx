import React from "react";
import { redirect } from "next/navigation";
import { getAuthenticatedAuthUser, getSessionUser } from "@/lib/auth/session";
import { LoginForm } from "./LoginForm";

export default async function LoginPage() {
  let authUser = null;
  let user = null;

  try {
    authUser = await getAuthenticatedAuthUser();
    if (authUser) {
      user = await getSessionUser();
    }
  } catch {
    // Database or Supabase unconfigured
  }

  if (user) {
    redirect("/chat");
  }

  if (authUser) {
    redirect("/verify");
  }

  return <LoginForm />;
}
