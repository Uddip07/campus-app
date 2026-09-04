import { ConfiguredNsutProvider } from "./nsut-provider";
import { InstitutionalEmailProvider } from "./email-provider";
import { StudentVerificationProvider } from "./types";
import { isNsutVerificationConfigured } from "../env";

let testProviderOverride: StudentVerificationProvider | null = null;

export function getVerificationProvider(): StudentVerificationProvider {
  if (testProviderOverride) {
    return testProviderOverride;
  }

  // If official NSUT verification authority API is configured, use it
  if (isNsutVerificationConfigured()) {
    return new ConfiguredNsutProvider();
  }

  // Default primary provider for Campus: Institutional Email Verification (@nsut.ac.in)
  return new InstitutionalEmailProvider();
}

// Allowed strictly for automated testing harnesses
export function setVerificationProviderForTesting(
  provider: StudentVerificationProvider | null
): void {
  if (process.env.NODE_ENV === "production") {
    throw new Error("Cannot override verification provider in production environment.");
  }
  testProviderOverride = provider;
}

export * from "./types";
export * from "./nsut-provider";
export * from "./email-provider";
