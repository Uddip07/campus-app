import { describe, it, expect } from "vitest";
import {
  encodeCompositeCursor,
  decodeCompositeCursor,
  buildCursorQuery,
} from "@/lib/pagination/cursor";

describe("Message Stable Composite Cursor Pagination", () => {
  it("encodes and decodes a composite cursor correctly", () => {
    const originalDate = new Date("2026-11-14T08:30:00.000Z");
    const originalId = "6735be9f893c5d642398a123";

    const encoded = encodeCompositeCursor({
      createdAt: originalDate,
      id: originalId,
    });

    expect(typeof encoded).toBe("string");
    expect(encoded.length).toBeGreaterThan(10);

    const decoded = decodeCompositeCursor(encoded);
    expect(decoded).not.toBeNull();
    expect(decoded?.createdAt.toISOString()).toBe(originalDate.toISOString());
    expect(decoded?.id).toBe(originalId);
  });

  it("handles backwards-compatible ISO date strings gracefully", () => {
    const isoString = "2026-11-14T08:30:00.000Z";
    const decoded = decodeCompositeCursor(isoString);

    expect(decoded).not.toBeNull();
    expect(decoded?.createdAt.toISOString()).toBe(isoString);
    expect(decoded?.id).toBe("");
  });

  it("returns null for malformed or invalid cursors", () => {
    expect(decodeCompositeCursor(null)).toBeNull();
    expect(decodeCompositeCursor(undefined)).toBeNull();
    expect(decodeCompositeCursor("")).toBeNull();
    expect(decodeCompositeCursor("not-a-valid-base64-or-date")).toBeNull();
  });

  it("constructs MongoDB query with stable compound or condition", () => {
    const cursor = {
      createdAt: new Date("2026-11-14T08:30:00.000Z"),
      id: "6735be9f893c5d642398a123",
    };

    const baseFilter = {
      roomId: "room-abc",
      moderationStatus: "approved",
    };

    const query = buildCursorQuery(cursor, baseFilter);

    expect(query.roomId).toBe("room-abc");
    expect(query.moderationStatus).toBe("approved");
    expect(query.$or).toBeDefined();
    expect(query.$or).toHaveLength(2);
    expect(query.$or[0]).toEqual({ createdAt: { $lt: cursor.createdAt } });
    expect(query.$or[1]).toEqual({
      createdAt: cursor.createdAt,
      _id: { $lt: cursor.id },
    });
  });

  it("falls back to simple lt when cursor has no id (legacy format)", () => {
    const cursor = {
      createdAt: new Date("2026-11-14T08:30:00.000Z"),
      id: "",
    };

    const baseFilter = { roomId: "room-xyz" };
    const query = buildCursorQuery(cursor, baseFilter);

    expect(query.roomId).toBe("room-xyz");
    expect(query.createdAt).toEqual({ $lt: cursor.createdAt });
    expect(query.$or).toBeUndefined();
  });

  it("returns unaltered base filter when cursor is null", () => {
    const baseFilter = { roomId: "room-xyz" };
    const query = buildCursorQuery(null, baseFilter);
    expect(query).toEqual(baseFilter);
  });
});
