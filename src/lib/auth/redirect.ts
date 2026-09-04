/**
 * Validates and sanitizes redirect paths to prevent Open Redirect vulnerabilities.
 * Ensures the target is strictly a relative path on the same origin.
 */
export function sanitizeRedirectPath(nextPath: string | null | undefined, fallback = "/verify"): string {
  if (!nextPath || typeof nextPath !== "string") {
    return fallback;
  }

  const trimmed = nextPath.trim();

  // Reject paths that don't start with '/' or start with '//' (protocol-relative) or contain backslashes
  if (!trimmed.startsWith("/") || trimmed.startsWith("//") || trimmed.startsWith("/\\") || trimmed.includes("\\")) {
    return fallback;
  }

  // Ensure it's parseable as a relative path and doesn't contain a scheme (e.g., javascript:, data:)
  try {
    const dummyBase = "http://localhost";
    const url = new URL(trimmed, dummyBase);

    // Ensure the origin matches dummy base and there is no hostname set in the relative path
    if (url.origin !== dummyBase) {
      return fallback;
    }

    return url.pathname + url.search + url.hash;
  } catch {
    return fallback;
  }
}
