import crypto from "crypto";

const ADJECTIVES = [
  "Amber", "Azure", "Brisk", "Cosmic", "Crimson", "Crystal", "Daring",
  "Echo", "Emerald", "Frost", "Golden", "Iron", "Lunar", "Mystic",
  "Noble", "Nova", "Orion", "Prism", "Radiant", "Shadow", "Silent",
  "Silver", "Solar", "Starlight", "Swift", "Velvet", "Vibrant", "Zenith"
];

const NOUNS = [
  "Badger", "Bear", "Cheetah", "Dolphin", "Eagle", "Falcon", "Fox",
  "Hawk", "Heron", "Jaguar", "Kestrel", "Koala", "Leopard", "Lynx",
  "Osprey", "Otter", "Owl", "Panda", "Phoenix", "Raven", "Seal",
  "Stag", "Swan", "Tiger", "Wolf"
];

export interface GeneratedIdentity {
  displayName: string;
  avatarSeed: string;
}

/**
 * Generates a cryptographically secure, randomized pseudonymous identity.
 * Example output: AnonymousCosmicFox42
 * Never uses hardcoded sequences or fabricated user names.
 */
export function generateAnonymousIdentity(): GeneratedIdentity {
  const adjIndex = crypto.randomInt(0, ADJECTIVES.length);
  const nounIndex = crypto.randomInt(0, NOUNS.length);
  const num = crypto.randomInt(10, 9999);

  const adjective = ADJECTIVES[adjIndex];
  const noun = NOUNS[nounIndex];

  const displayName = `Anonymous${adjective}${noun}${num}`;
  const avatarSeed = crypto.randomBytes(8).toString("hex");

  return {
    displayName,
    avatarSeed,
  };
}
