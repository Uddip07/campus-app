import mongoose from "mongoose";

declare global {
  // eslint-disable-next-line no-var
  var mongooseConnection: {
    conn: typeof mongoose | null;
    promise: Promise<typeof mongoose> | null;
  } | undefined;
}

let cached = global.mongooseConnection;

if (!cached) {
  cached = global.mongooseConnection = { conn: null, promise: null };
}

export function getMongoUri(): string {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    // In automated test environments without explicit MONGODB_URI, do NOT hang on dead ports
    if (process.env.NODE_ENV === "test" || process.env.VITEST) {
      return "";
    }
    return process.env.NODE_ENV === "production"
      ? ""
      : "mongodb://127.0.0.1:27017/campusconnect";
  }
  return uri;
}

export function isMongoConfigured(): boolean {
  return Boolean(getMongoUri());
}

export interface MongoConnectionHealth {
  connected: boolean;
  state: "disconnected" | "connected" | "connecting" | "disconnecting" | "uninitialized";
  databaseName: string | null;
  host: string | null;
  modelsLoaded: number;
}

export function getMongoHealth(): MongoConnectionHealth {
  const readyState = mongoose.connection.readyState;
  const stateMap: Record<number, MongoConnectionHealth["state"]> = {
    0: "disconnected",
    1: "connected",
    2: "connecting",
    3: "disconnecting",
  };
  const stateStr = stateMap[readyState] || "uninitialized";

  return {
    connected: readyState === 1,
    state: stateStr,
    databaseName: mongoose.connection.name || null,
    host: mongoose.connection.host || null,
    modelsLoaded: Object.keys(mongoose.models).length,
  };
}

/**
 * Centralized MongoDB Connection Manager
 * Caches connections across Next.js HMR reloads and serverless invocations.
 */
export async function connectToDatabase(): Promise<typeof mongoose> {
  const uri = getMongoUri();

  if (!uri) {
    throw new Error(
      "MongoDB connection is unavailable: MONGODB_URI is not configured in environment"
    );
  }

  if (cached!.conn) {
    return cached!.conn;
  }

  if (!cached!.promise) {
    const opts: mongoose.ConnectOptions = {
      bufferCommands: false,
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    };

    cached!.promise = mongoose
      .connect(uri, opts)
      .then((mongooseInstance) => {
        return mongooseInstance;
      })
      .catch((err) => {
        cached!.promise = null;
        throw err;
      });
  }

  try {
    cached!.conn = await cached!.promise;
  } catch (e) {
    cached!.promise = null;
    throw e;
  }

  return cached!.conn;
}

export { mongoose };
