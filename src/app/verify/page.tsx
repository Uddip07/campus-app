import React from "react";
import { redirect } from "next/navigation";
import { getAuthenticatedAuthUser, getSessionUser } from "@/lib/auth/session";
import { VerifyClientForm } from "./VerifyClientForm";

export default async function VerifyPage() {
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

  // A logged-in/onboarded user visiting /verify should be redirected to /chat
  if (user) {
    redirect("/chat");
  }

  return <VerifyClientForm initialEmail={authUser?.email ?? null} />;
}
