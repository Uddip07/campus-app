import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { canAccessRoom } from "@/lib/auth/rbac";
import { db, schema } from "@/db";
import { RoomDTO } from "@/lib/types";

export async function GET() {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json(
        { error: "Authenticated user is required" },
        { status: 401 }
      );
    }

    // Query rooms with their cohort details
    const allRooms = await db.query.rooms.findMany({
      with: {
        cohort: true,
      },
    });

    const authorizedRooms: RoomDTO[] = allRooms
      .filter((room) =>
        canAccessRoom(
          { role: user.role, cohortId: user.cohortId, status: user.status },
          { type: room.type, cohortId: room.cohortId }
        )
      )
      .map((room) => ({
        id: room.id,
        type: room.type,
        name: room.name,
        cohortId: room.cohortId,
        graduationYear: room.cohort?.graduationYear ?? null,
      }));

    return NextResponse.json({ rooms: authorizedRooms });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Error fetching rooms";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
