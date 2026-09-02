import { redirect } from "next/navigation";
import { getSessionUser, sanitizeUserProfile } from "@/lib/auth/session";
import { AdminDashboard } from "@/components/admin/AdminDashboard";

export default async function AdminPage() {
  const user = await getSessionUser();
  if (!user) {
    redirect("/login");
  }

  return <AdminDashboard currentUser={sanitizeUserProfile(user)} />;
}
