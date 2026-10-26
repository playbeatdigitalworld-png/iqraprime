const SENSITIVE_KEY = /^(apikey|api_key|pass|password|newpass|info|callback|token|secret|authorization|cookie|whatsapp_otp|otp|totp_secret|password_hash|provider_password_enc)$/i;

export function maskObject(value: unknown, depth = 0): unknown {
  if (depth > 6) return "[truncated]";
  if (Array.isArray(value)) return value.map((v) => maskObject(v, depth + 1));
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) out[k] = SENSITIVE_KEY.test(k) ? "[redacted]" : maskObject(v, depth + 1);
    return out;
  }
  if (typeof value === "string") return maskText(value);
  return value;
}

/** Strips credential query params / URLs from free text (provider messages can echo them). */
export function maskText(s: string, max = 300): string {
  return s
    .replace(/(apikey|password|pass|username|token)=([^&\s"']*)/gi, (_m, k: string) => `${k}=[redacted]`)
    .slice(0, max);
}
