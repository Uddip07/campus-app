import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

export function normalizeDatabaseUrl(raw: string | undefined): { url: string; isTransactionPooler: boolean } | null {
  if (!raw) return null;
  try {
    const parsed = new URL(raw);
    let isTransactionPooler = parsed.port === "6543";

    // Supabase direct connection hostnames (db.<ref>.supabase.co) only have IPv6 AAAA DNS records.
    // In IPv4-only serverless environments (e.g. Vercel), direct connections fail with
    // "getaddrinfo ENOTFOUND db.<ref>.supabase.co".
    // Automatically translate direct connection URLs to the IPv4-supported Supabase Connection Pooler.
    if (parsed.hostname.startsWith("db.") && parsed.hostname.endsWith(".supabase.co")) {
      const projectRef = parsed.hostname.replace(/^db\./, "").replace(/\.supabase\.co$/, "");
      const region = process.env.SUPABASE_POOLER_REGION || "ap-southeast-1";
      parsed.hostname = `aws-0-${region}.pooler.supabase.com`;
      if (parsed.username === "postgres") {
        parsed.username = `postgres.${projectRef}`;
      }
      if (parsed.port === "6543") {
        isTransactionPooler = true;
      } else {
        parsed.port = "5432";
      }
      if (!parsed.searchParams.has("sslmode")) {
        parsed.searchParams.set("sslmode", "require");
      }
      return { url: parsed.toString(), isTransactionPooler };
    }

    if (parsed.hostname.includes("pooler.supabase.com") && parsed.port === "6543") {
      isTransactionPooler = true;
    }

    return { url: raw, isTransactionPooler };
  } catch {
    return { url: raw, isTransactionPooler: false };
  }
}

const connectionString = process.env.DATABASE_URL;

class MissingDatabaseProxy {
  constructor() {
    return new Proxy(this, {
      get() {
        throw new Error(
          "Database connection is unavailable: DATABASE_URL is not configured."
        );
      },
      apply() {
        throw new Error(
          "Database connection is unavailable: DATABASE_URL is not configured."
        );
      },
    });
  }
}

let dbInstance: ReturnType<typeof drizzle<typeof schema>>;

if (!connectionString) {
  // Graceful proxy that throws clear truthful configuration error on access
  dbInstance = new MissingDatabaseProxy() as unknown as ReturnType<
    typeof drizzle<typeof schema>
  >;
} else {
  const resolved = normalizeDatabaseUrl(connectionString);
  const client = postgres(resolved?.url || connectionString, {
    max: 10,
    idle_timeout: 20,
    connect_timeout: 10,
    prepare: resolved?.isTransactionPooler ? false : undefined,
  });
  dbInstance = drizzle(client, { schema });
}

export const db = dbInstance;
export { schema };
