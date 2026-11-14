export interface CompositeCursor {
  createdAt: Date;
  id: string;
}

/**
 * Encodes a composite cursor (Date + Document ID) into a URL-safe base64 string.
 */
export function encodeCompositeCursor(cursor: CompositeCursor): string {
  const payload = JSON.stringify({
    t: cursor.createdAt.toISOString(),
    i: cursor.id,
  });
  return Buffer.from(payload, "utf-8").toString("base64url");
}

/**
 * Decodes a URL-safe composite cursor into Date and ID components.
 * Returns null if cursor is missing, unparseable, or invalid.
 */
export function decodeCompositeCursor(raw: string | null | undefined): CompositeCursor | null {
  if (!raw || typeof raw !== "string") {
    return null;
  }

  try {
    const jsonStr = Buffer.from(raw, "base64url").toString("utf-8");
    const parsed = JSON.parse(jsonStr);

    if (!parsed || typeof parsed !== "object") {
      return null;
    }

    const { t, i } = parsed;
    if (!t || !i || typeof i !== "string") {
      return null;
    }

    const date = new Date(t);
    if (isNaN(date.getTime())) {
      return null;
    }

    return {
      createdAt: date,
      id: i,
    };
  } catch {
    // If not a base64url composite cursor, attempt backwards-compatible ISO date parsing
    const fallbackDate = new Date(raw);
    if (!isNaN(fallbackDate.getTime())) {
      return {
        createdAt: fallbackDate,
        id: "",
      };
    }
    return null;
  }
}

/**
 * Builds MongoDB filter condition for stable composite cursor pagination.
 *
 * Guaranteed correctness:
 * (createdAt < cursor.createdAt) OR
 * (createdAt == cursor.createdAt AND _id < cursor.id)
 */
export function buildCursorQuery(cursor: CompositeCursor | null, baseFilter: Record<string, any> = {}) {
  if (!cursor) {
    return baseFilter;
  }

  // If no ID (fallback legacy cursor), use simple lt
  if (!cursor.id) {
    return {
      ...baseFilter,
      createdAt: { $lt: cursor.createdAt },
    };
  }

  return {
    ...baseFilter,
    $or: [
      { createdAt: { $lt: cursor.createdAt } },
      {
        createdAt: cursor.createdAt,
        _id: { $lt: cursor.id },
      },
    ],
  };
}
