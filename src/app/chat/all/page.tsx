import { redirect } from "next/navigation";
import { getAuthenticatedAuthUser, getSessionUser, sanitizeUserProfile } from "@/lib/auth/session";
import { connectToDatabase } from "@/db/mongodb";
import { Room } from "@/db/models/Room";
import { ChatContainer } from "@/components/chat/ChatContainer";

export default async function AllCollegeChatPage() {
  const authUser = await getAuthenticatedAuthUser();
  if (!authUser) {
    redirect("/login");
  }

  const user = await getSessionUser();
  if (!user) {
    redirect("/verify?setup=required");
  }

  await connectToDatabase();

  // Look up or initialize global room in MongoDB
  let globalRoom = await Room.findOne({ type: "global" });
  if (!globalRoom) {
    globalRoom = await Room.create({
      type: "global",
      name: "All College",
      cohortId: null,
    });
  }

  return (
    <ChatContainer
      roomId={globalRoom._id.toString()}
      roomName="All College"
      currentUser={sanitizeUserProfile(user)}
    />
  );
}
