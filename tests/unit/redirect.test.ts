import { describe, it, expect } from "vitest";
import { sanitizeRedirectPath } from "@/lib/auth/redirect";

describe("Open Redirect Prevention - sanitizeRedirectPath", () => {
  it("allows safe internal relative paths", () => {
    expect(sanitizeRedirectPath("/verify")).toBe("/verify");
    expect(sanitizeRedirectPath("/chat/all")).toBe("/chat/all");
    expect(sanitizeRedirectPath("/chat/cohort?batch=2026")).toBe("/chat/cohort?batch=2026");
    expect(sanitizeRedirectPath("/announcements#pinned")).toBe("/announcements#pinned");
  });

  it("strictly blocks external absolute URLs", () => {
    expect(sanitizeRedirectPath("https://evil.com")).toBe("/verify");
    expect(sanitizeRedirectPath("http://attacker.org/verify")).toBe("/verify");
    expect(sanitizeRedirectPath("ftp://malicious.com")).toBe("/verify");
  });

  it("strictly blocks protocol-relative URLs", () => {
    expect(sanitizeRedirectPath("//evil.com")).toBe("/verify");
    expect(sanitizeRedirectPath("//evil.com/verify")).toBe("/verify");
  });

  it("strictly blocks backslash bypass attempts", () => {
    expect(sanitizeRedirectPath("/\\evil.com")).toBe("/verify");
    expect(sanitizeRedirectPath("\\evil.com")).toBe("/verify");
    expect(sanitizeRedirectPath("/test\\evil.com")).toBe("/verify");
  });

  it("strictly blocks javascript and data URIs", () => {
    expect(sanitizeRedirectPath("javascript:alert(1)")).toBe("/verify");
    expect(sanitizeRedirectPath("data:text/html,<script>alert(1)</script>")).toBe("/verify");
  });

  it("falls back to default or specified fallback on null, undefined, or invalid inputs", () => {
    expect(sanitizeRedirectPath(null)).toBe("/verify");
    expect(sanitizeRedirectPath(undefined)).toBe("/verify");
    expect(sanitizeRedirectPath("")).toBe("/verify");
    expect(sanitizeRedirectPath("not-a-path", "/custom-fallback")).toBe("/custom-fallback");
  });
});
