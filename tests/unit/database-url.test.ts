import { describe, it, expect } from "vitest";
import { normalizeDatabaseUrl } from "@/db";

describe("Supabase Database Connection Normalization", () => {
  it("automatically converts IPv6-only direct Supabase host to IPv4-compatible pooler host on port 5432", () => {
    const raw = "postgresql://postgres:secret123@db.tdnyjsydadsiwbvgqouy.supabase.co:5432/postgres";
    const res = normalizeDatabaseUrl(raw);

    expect(res).not.toBeNull();
    expect(res?.isTransactionPooler).toBe(false);
    const parsed = new URL(res!.url);
    expect(parsed.hostname).toBe("aws-0-ap-southeast-1.pooler.supabase.com");
    expect(parsed.port).toBe("5432");
    expect(parsed.username).toBe("postgres.tdnyjsydadsiwbvgqouy");
    expect(parsed.password).toBe("secret123");
    expect(parsed.searchParams.get("sslmode")).toBe("require");
  });

  it("automatically converts direct Supabase host on port 6543 with transaction pooler flag", () => {
    const raw = "postgresql://postgres:secret123@db.tdnyjsydadsiwbvgqouy.supabase.co:6543/postgres";
    const res = normalizeDatabaseUrl(raw);

    expect(res).not.toBeNull();
    expect(res?.isTransactionPooler).toBe(true);
    const parsed = new URL(res!.url);
    expect(parsed.hostname).toBe("aws-0-ap-southeast-1.pooler.supabase.com");
    expect(parsed.port).toBe("6543");
    expect(parsed.username).toBe("postgres.tdnyjsydadsiwbvgqouy");
  });

  it("preserves existing pooler URLs without modification", () => {
    const raw = "postgresql://postgres.tdnyjsydadsiwbvgqouy:secret123@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres?sslmode=require";
    const res = normalizeDatabaseUrl(raw);

    expect(res).not.toBeNull();
    expect(res?.url).toBe(raw);
    expect(res?.isTransactionPooler).toBe(true);
  });

  it("preserves local database URLs without modification", () => {
    const raw = "postgresql://postgres:postgres@localhost:5432/campus";
    const res = normalizeDatabaseUrl(raw);

    expect(res).not.toBeNull();
    expect(res?.url).toBe(raw);
    expect(res?.isTransactionPooler).toBe(false);
  });

  it("handles undefined or empty connection strings gracefully", () => {
    expect(normalizeDatabaseUrl(undefined)).toBeNull();
    expect(normalizeDatabaseUrl("")).toBeNull();
  });
});
