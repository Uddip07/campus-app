import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { canAccessRoom } from "@/lib/auth/rbac";
import { connectToDatabase } from "@/db/mongodb";
import { Room } from "@/db/models/Room";
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

    await connectToDatabase();

    // Query rooms with their cohort details from MongoDB
    const allRooms = await Room.find().populate<{
      cohortId: { _id: any; graduationYear: number } | null;
    }>("cohortId");

    const authorizedRooms: RoomDTO[] = allRooms
      .filter((room) => {
        const cohortIdStr = room.cohortId ? (room.cohortId as any)._id.toString() : null;
        return canAccessRoom(
          { role: user.role, cohortId: user.cohortId, status: user.status },
          { type: room.type, cohortId: cohortIdStr }
        );
      })
      .map((room) => {
        const cohortData = room.cohortId as any;
        return {
          id: room._id.toString(),
          type: room.type,
          name: room.name,
          cohortId: cohortData?._id ? cohortData._id.toString() : null,
          graduationYear: cohortData?.graduationYear ?? null,
        };
      });

    return NextResponse.json({ rooms: authorizedRooms });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Error fetching rooms";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
