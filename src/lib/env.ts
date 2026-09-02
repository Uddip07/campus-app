// Environment configuration checker and validator

export function getSupabaseConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  const isConfigured = Boolean(url && anonKey);

  return {
    url: url || "",
    anonKey: anonKey || "",
    serviceKey: serviceKey || "",
    isConfigured,
  };
}

export function isSupabaseConfigured(): boolean {
  return getSupabaseConfig().isConfigured;
}

export function assertSupabaseConfigured(): void {
  if (!isSupabaseConfigured()) {
    throw new Error(
      "Supabase configuration is missing. NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY must be configured in .env."
    );
  }
}

export function getDatabaseConfig() {
  const url = process.env.DATABASE_URL;
  return {
    url: url || "",
    isConfigured: Boolean(url),
  };
}

export function isDatabaseConfigured(): boolean {
  return getDatabaseConfig().isConfigured;
}

export function assertDatabaseConfigured(): void {
  if (!isDatabaseConfigured()) {
    throw new Error(
      "Database connection is unavailable: DATABASE_URL is not configured."
    );
  }
}

export function getNsutVerificationConfig() {
  const url = process.env.NSUT_VERIFICATION_URL;
  const clientId = process.env.NSUT_VERIFICATION_CLIENT_ID;
  const clientSecret = process.env.NSUT_VERIFICATION_CLIENT_SECRET;

  return {
    url: url || "",
    clientId: clientId || "",
    clientSecret: clientSecret || "",
    isConfigured: Boolean(url && clientId && clientSecret),
  };
}

export function isNsutVerificationConfigured(): boolean {
  return getNsutVerificationConfig().isConfigured;
}

export function isRedisConfigured(): boolean {
  return Boolean(
    process.env.REDIS_URL ||
      (process.env.UPSTASH_REDIS_REST_URL &&
        process.env.UPSTASH_REDIS_REST_TOKEN)
  );
}
