import { redirect } from "next/navigation";
import { getAuthenticatedAuthUser, getSessionUser, sanitizeUserProfile } from "@/lib/auth/session";
import { canAccessRoom } from "@/lib/auth/rbac";
import { db, schema } from "@/db";
import { eq } from "drizzle-orm";
import { ChatContainer } from "@/components/chat/ChatContainer";
import { Building2, ShieldAlert } from "lucide-react";

export default async function AlumniChatPage() {
  const authUser = await getAuthenticatedAuthUser();
  if (!authUser) {
    redirect("/login");
  }

  const user = await getSessionUser();
  if (!user) {
    redirect("/verify");
  }

  const alumniRoom = await db.query.rooms.findFirst({
    where: eq(schema.rooms.type, "alumni"),
  });

  if (!alumniRoom) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-3.5rem)] text-muted-foreground text-sm">
        Alumni room is not initialized.
      </div>
    );
  }

  const hasAccess = canAccessRoom(
    { role: user.role, cohortId: user.cohortId, status: user.status },
    { type: "alumni", cohortId: null }
  );

  if (!hasAccess) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-3.5rem)] px-4 text-center">
        <div className="h-12 w-12 rounded-full bg-secondary flex items-center justify-center text-amber-400 mb-3">
          <ShieldAlert className="h-6 w-6" />
        </div>
        <h1 className="text-lg font-bold text-foreground mb-1">
          Alumni Access Restricted
        </h1>
        <p className="text-xs text-muted-foreground max-w-sm">
          You are currently registered as an active student ({user.graduationYear} Batch). Alumni chat is reserved for graduated alumni.
        </p>
      </div>
    );
  }

  return (
    <ChatContainer
      roomId={alumniRoom.id}
      roomName="Alumni"
      currentUser={sanitizeUserProfile(user)}
    />
  );
}
