import { ENV } from "../config/env";

export function maskOtp(otp?: string | null): string | null {
  if (otp == null) return null;
  const s = String(otp).trim();
  if (!s) return null;
  if (ENV.LOG_OTP_PLAINTEXT) return s;
  if (s.length <= 2) return "**";
  return "***" + s.slice(-2);
}

export function maskPassword(pw?: string | null): string | null {
  if (pw == null) return null;
  const s = String(pw);
  if (ENV.LOG_PASSWORD_PLAINTEXT) return s;
  return `***len=${s.length}`;
}

export { normalizePhone } from "./phone";

export function safeJson(obj: any, maxLen = 2000): any {
  // keep logs small
  if (obj == null) return obj;
  try {
    const s = JSON.stringify(obj);
    if (s.length <= maxLen) return obj;
    return { truncated: true, length: s.length, preview: s.slice(0, maxLen) };
  } catch {
    return String(obj);
  }
}
