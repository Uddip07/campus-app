import type { Metadata } from "next";
import "./globals.css";
import { getSessionUser, getAuthenticatedAuthUser, sanitizeUserProfile } from "@/lib/auth/session";
import { Navbar } from "@/components/layout/Navbar";

export const metadata: Metadata = {
  title: "Campus — NSUT Anonymous Community",
  description: "Verified but pseudonymous communication platform for NSUT students and alumni.",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  let userProfile = null;
  let authEmail: string | null = null;

  try {
    const authUser = await getAuthenticatedAuthUser();
    if (authUser) {
      authEmail = authUser.email ?? null;
    }
    const user = await getSessionUser();
    if (user) {
      userProfile = sanitizeUserProfile(user);
    }
  } catch {
    // Session retrieval may fail if db is unconfigured; handled gracefully
  }

  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-background text-foreground antialiased flex flex-col">
        <Navbar user={userProfile} authenticatedEmail={authEmail} />
        <main className="flex-1 pb-16 md:pb-0">{children}</main>
      </body>
    </html>
  );
}
