import { ConfiguredNsutProvider } from "./nsut-provider";
import { StudentVerificationProvider } from "./types";

let currentProvider: StudentVerificationProvider = new ConfiguredNsutProvider();

export function getVerificationProvider(): StudentVerificationProvider {
  return currentProvider;
}

// Allowed strictly for automated testing harnesses
export function setVerificationProviderForTesting(
  provider: StudentVerificationProvider
): void {
  if (process.env.NODE_ENV === "production") {
    throw new Error("Cannot override verification provider in production environment.");
  }
  currentProvider = provider;
}

export * from "./types";
export * from "./nsut-provider";
