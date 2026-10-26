export function newId(prefix: string): string {
  return `${prefix}_${crypto.randomUUID().replace(/-/g, "")}`;
}

const ALPHABET = "abcdefghijklmnopqrstuvwxyz0123456789";

/** Unbiased random string (rejection sampling: 36 * 7 = 252). */
export function randomString(length: number, alphabet = ALPHABET): string {
  const limit = 256 - (256 % alphabet.length);
  let out = "";
  while (out.length < length) {
    const buf = crypto.getRandomValues(new Uint8Array(length * 2));
    for (const b of buf) {
      if (b < limit && out.length < length) out += alphabet[b % alphabet.length];
    }
  }
  return out;
}
