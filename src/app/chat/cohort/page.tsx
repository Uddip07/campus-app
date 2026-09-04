import { redirect } from "next/navigation";
import { getAuthenticatedAuthUser, getSessionUser, sanitizeUserProfile } from "@/lib/auth/session";
import { db, schema } from "@/db";
import { eq, and } from "drizzle-orm";
import { ChatContainer } from "@/components/chat/ChatContainer";

export default async function CohortChatPage() {
  const authUser = await getAuthenticatedAuthUser();
  if (!authUser) {
    redirect("/login");
  }

  const user = await getSessionUser();
  if (!user) {
    redirect("/verify");
  }

  // Look up student's cohort room
  let cohortRoom = await db.query.rooms.findFirst({
    where: and(
      eq(schema.rooms.type, "cohort"),
      eq(schema.rooms.cohortId, user.cohortId)
    ),
  });

  if (!cohortRoom) {
    // Create cohort room if missing
    const [created] = await db
      .insert(schema.rooms)
      .values({
        type: "cohort",
        name: `${user.graduationYear} Batch`,
        cohortId: user.cohortId,
      })
      .returning();
    cohortRoom = created;
  }

  return (
    <ChatContainer
      roomId={cohortRoom.id}
      roomName={`${user.graduationYear} Batch`}
      currentUser={sanitizeUserProfile(user)}
    />
  );
}
