import React from "react";
import { redirect } from "next/navigation";
import { getAuthenticatedAuthUser, getSessionUser, sanitizeUserProfile } from "@/lib/auth/session";
import { db, schema } from "@/db";
import { eq } from "drizzle-orm";
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

  // Look up global room
  const globalRoom = await db.query.rooms.findFirst({
    where: eq(schema.rooms.type, "global"),
  });

  if (!globalRoom) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-3.5rem)] text-muted-foreground text-sm">
        Global room has not been initialized. Please run database migrations.
      </div>
    );
  }

  return (
    <ChatContainer
      roomId={globalRoom.id}
      roomName="All College"
      currentUser={sanitizeUserProfile(user)}
    />
  );
}
