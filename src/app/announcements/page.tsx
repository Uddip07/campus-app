import { redirect } from "next/navigation";
import { getSessionUser, sanitizeUserProfile } from "@/lib/auth/session";
import { AnnouncementFeed } from "@/components/announcements/AnnouncementFeed";

export default async function AnnouncementsPage() {
  const user = await getSessionUser();
  if (!user) {
    redirect("/login");
  }

  return <AnnouncementFeed currentUser={sanitizeUserProfile(user)} />;
}
