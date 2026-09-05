import { redirect, notFound } from "next/navigation";
import { getAuthenticatedAuthUser, getSessionUser, sanitizeUserProfile } from "@/lib/auth/session";
import { canAccessRoom } from "@/lib/auth/rbac";
import { db, schema } from "@/db";
import { eq } from "drizzle-orm";
import { ChatContainer } from "@/components/chat/ChatContainer";

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

  const room = await db.query.rooms.findFirst({
    where: eq(schema.rooms.id, roomId),
  });

  if (!room) {
    notFound();
  }

  const hasAccess = canAccessRoom(
    { role: user.role, cohortId: user.cohortId, status: user.status },
    { type: room.type, cohortId: room.cohortId }
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
      roomId={room.id}
      roomName={room.name}
      currentUser={sanitizeUserProfile(user)}
    />
  );
}
