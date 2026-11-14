// Environment configuration checker and validator

export function getSupabaseConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const secretKey =
    process.env.SUPABASE_SECRET_KEY ||
    process.env.SUPABASE_SERVICE_ROLE_KEY;

  const isConfigured = Boolean(url && publishableKey);

  return {
    url: url || "",
    publishableKey: publishableKey || "",
    secretKey: secretKey || "",
    isConfigured,
  };
}

export function isSupabaseConfigured(): boolean {
  return getSupabaseConfig().isConfigured;
}

export function assertSupabaseConfigured(): void {
  if (!isSupabaseConfigured()) {
    throw new Error(
      "Supabase configuration is missing. NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY must be configured in .env."
    );
  }
}

export function getMongoConfig() {
  const url = process.env.MONGODB_URI;
  return {
    url: url || "",
    isConfigured: Boolean(url),
  };
}

export function isMongoConfigured(): boolean {
  return getMongoConfig().isConfigured;
}

export function assertMongoConfigured(): void {
  if (!isMongoConfigured()) {
    throw new Error(
      "MongoDB connection is unavailable: MONGODB_URI is not configured in environment."
    );
  }
}

// Backward-compatible aliases
export const getDatabaseConfig = getMongoConfig;
export const isDatabaseConfigured = isMongoConfigured;
export const assertDatabaseConfigured = assertMongoConfigured;

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

export const INSTITUTIONAL_EMAIL_DOMAIN = "nsut.ac.in";

export function isAllowedInstitutionalEmail(email: string): boolean {
  if (!email || typeof email !== "string") {
    return false;
  }
  const normalized = email.trim().toLowerCase();
  const atIndex = normalized.lastIndexOf("@");
  if (atIndex <= 0) {
    return false;
  }
  const domain = normalized.slice(atIndex + 1);
  return domain === INSTITUTIONAL_EMAIL_DOMAIN;
}
