import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

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
  // Real postgres client
  const client = postgres(connectionString, {
    max: 10,
    idle_timeout: 20,
    connect_timeout: 10,
  });
  dbInstance = drizzle(client, { schema });
}

export const db = dbInstance;
export { schema };
