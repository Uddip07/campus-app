import { redirect } from "next/navigation";
import { getAuthenticatedAuthUser, getSessionUser, sanitizeUserProfile } from "@/lib/auth/session";
import { connectToDatabase } from "@/db/mongodb";
import { Room } from "@/db/models/Room";
import { ChatContainer } from "@/components/chat/ChatContainer";
import mongoose from "mongoose";

export default async function CohortChatPage() {
  const authUser = await getAuthenticatedAuthUser();
  if (!authUser) {
    redirect("/login");
  }

  const user = await getSessionUser();
  if (!user) {
    redirect("/verify?setup=required");
  }

  await connectToDatabase();

  const cohortObjectId = new mongoose.Types.ObjectId(user.cohortId);

  // Look up student's cohort room in MongoDB
  let cohortRoom = await Room.findOne({
    type: "cohort",
    cohortId: cohortObjectId,
  });

  if (!cohortRoom) {
    cohortRoom = await Room.create({
      type: "cohort",
      name: `${user.graduationYear} Batch`,
      cohortId: cohortObjectId,
    });
  }

  return (
    <ChatContainer
      roomId={cohortRoom._id.toString()}
      roomName={`${user.graduationYear} Batch`}
      currentUser={sanitizeUserProfile(user)}
    />
  );
}
