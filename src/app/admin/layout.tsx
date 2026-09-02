import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth/session";
import { canModerate } from "@/lib/auth/rbac";
import { ShieldAlert } from "lucide-react";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getSessionUser();
  if (!user) {
    redirect("/login");
  }

  if (!canModerate(user.role)) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-3.5rem)] px-4 text-center">
        <div className="h-12 w-12 rounded-full bg-secondary flex items-center justify-center text-destructive mb-3">
          <ShieldAlert className="h-6 w-6" />
        </div>
        <h1 className="text-xl font-bold text-foreground mb-1">
          403 — Unauthorized Staff Access
        </h1>
        <p className="text-xs text-muted-foreground max-w-md">
          Access to moderation and administrative tooling is strictly restricted to designated NSUT staff and moderators.
        </p>
      </div>
    );
  }

  return <>{children}</>;
}
