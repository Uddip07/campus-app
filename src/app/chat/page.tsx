import React from "react";
import { redirect } from "next/navigation";
import { getAuthenticatedAuthUser, getSessionUser, sanitizeUserProfile } from "@/lib/auth/session";
import { connectToDatabase, isMongoConfigured } from "@/db/mongodb";
import { db, Room } from "@/db";
import { ChatContainer } from "@/components/chat/ChatContainer";

export default async function ChatPage() {
  const authUser = await getAuthenticatedAuthUser();
  if (!authUser) {
    redirect("/login");
  }

  const user = await getSessionUser();
  if (!user) {
    redirect("/verify?setup=required");
  }

  let globalRoomId = "r-global";
  let globalRoomName = "All College";

  if (typeof (db as any)?.query?.rooms?.findFirst === "function") {
    const mockRoom = await (db as any).query.rooms.findFirst();
    if (mockRoom) {
      globalRoomId = mockRoom.id;
      globalRoomName = mockRoom.name || "All College";
    }
  } else {
    await connectToDatabase();
    let globalRoom = await Room.findOne({ type: "global" });
    if (!globalRoom) {
      globalRoom = await Room.create({
        type: "global",
        name: "All College",
        cohortId: null,
      });
    }
    globalRoomId = globalRoom._id.toString();
    globalRoomName = globalRoom.name;
  }

  return (
    <ChatContainer
      roomId={globalRoomId}
      roomName={globalRoomName}
      currentUser={sanitizeUserProfile(user)}
    />
  );
}
