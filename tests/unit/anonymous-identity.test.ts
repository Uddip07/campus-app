import { describe, it, expect } from "vitest";
import { generateAnonymousIdentity } from "@/lib/identity/generator";

describe("Anonymous Identity Generation", () => {
  it("generates an identity starting with Anonymous followed by adjective, noun, and number", () => {
    const identity = generateAnonymousIdentity();
    expect(identity.displayName).toMatch(/^Anonymous[A-Z][a-z]+[A-Z][a-z]+\d+$/);
    expect(identity.avatarSeed).toBeTruthy();
    expect(typeof identity.avatarSeed).toBe("string");
  });

  it("produces high entropy and uniqueness without repeating across multiple invocations", () => {
    const count = 50;
    const generated = new Set<string>();

    for (let i = 0; i < count; i++) {
      const { displayName } = generateAnonymousIdentity();
      generated.add(displayName);
    }

    expect(generated.size).toBe(count);
  });

  it("does not generate forbidden placeholder names like Anonymous User 1 or TestUser", () => {
    for (let i = 0; i < 20; i++) {
      const { displayName } = generateAnonymousIdentity();
      expect(displayName).not.toBe("Anonymous User 1");
      expect(displayName).not.toBe("Anonymous User 2");
      expect(displayName).not.toBe("User123");
      expect(displayName).not.toBe("TestUser");
    }
  });
});
