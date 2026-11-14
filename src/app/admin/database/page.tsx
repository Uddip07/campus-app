import { redirect } from "next/navigation";
import { getSessionUser, sanitizeUserProfile } from "@/lib/auth/session";
import { DatabaseExplorer } from "@/components/admin/DatabaseExplorer";

export const metadata = {
  title: "MongoDB Database Explorer — CampusConnect Admin",
  description: "Administrative MongoDB explorer, collection inspector, and developer dashboard.",
};

export default async function AdminDatabasePage() {
  const user = await getSessionUser();
  if (!user) {
    redirect("/login");
  }

  if (!["admin", "super_admin"].includes(user.role)) {
    redirect("/chat");
  }

  return <DatabaseExplorer currentUser={sanitizeUserProfile(user)} />;
}
