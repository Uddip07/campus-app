import { redirect } from "next/navigation";
import { getAuthenticatedAuthUser, getSessionUser, sanitizeUserProfile } from "@/lib/auth/session";
import { AnnouncementFeed } from "@/components/announcements/AnnouncementFeed";

export default async function AnnouncementsPage() {
  const authUser = await getAuthenticatedAuthUser();
  if (!authUser) {
    redirect("/login");
  }

  const user = await getSessionUser();
  if (!user) {
    redirect("/verify?setup=required");
  }

  return <AnnouncementFeed currentUser={sanitizeUserProfile(user)} />;
}
