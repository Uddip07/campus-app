import { redirect, notFound } from "next/navigation";
import { getAuthenticatedAuthUser, getSessionUser, sanitizeUserProfile } from "@/lib/auth/session";
import { canAccessRoom } from "@/lib/auth/rbac";
import { connectToDatabase } from "@/db/mongodb";
import { Room } from "@/db/models/Room";
import { ChatContainer } from "@/components/chat/ChatContainer";
import mongoose from "mongoose";

interface RoomPageProps {
  params: {
    roomId: string;
  };
}

export default async function DynamicRoomPage({ params }: RoomPageProps) {
  const authUser = await getAuthenticatedAuthUser();
  if (!authUser) {
    redirect("/login");
  }

  const user = await getSessionUser();
  if (!user) {
    redirect("/verify?setup=required");
  }

  const { roomId } = params;

  if (!mongoose.Types.ObjectId.isValid(roomId)) {
    notFound();
  }

  await connectToDatabase();

  const room = await Room.findById(roomId);

  if (!room) {
    notFound();
  }

  const cohortIdStr = room.cohortId ? room.cohortId.toString() : null;
  const hasAccess = canAccessRoom(
    { role: user.role, cohortId: user.cohortId, status: user.status },
    { type: room.type, cohortId: cohortIdStr }
  );

  if (!hasAccess) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-3.5rem)] px-4 text-center">
        <h1 className="text-lg font-bold text-foreground mb-1">
          Access Denied
        </h1>
        <p className="text-xs text-muted-foreground">
          You are not authorized to access this room.
        </p>
      </div>
    );
  }

  return (
    <ChatContainer
      roomId={room._id.toString()}
      roomName={room.name}
      currentUser={sanitizeUserProfile(user)}
    />
  );
}
