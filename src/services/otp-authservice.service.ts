import { ENV } from "../config/env";

export type DebugOtpResult = {
  otp: string | null;
  source: "upstash" | "redis" | "none";
  httpStatus?: number | null;
  pathTried?: string;
  reason?: string;
  raw?: any;
};

type Logger = {
  info: (o: any, m?: string) => void;
  warn: (o: any, m?: string) => void;
  error: (o: any, m?: string) => void;
  debug: (o: any, m?: string) => void;
};

function normalizeOtp(v: any): string | null {
  if (v == null) return null;

  if (typeof v === "string") {
    const s = v.trim();
    if (!s) return null;

    try {
      return normalizeOtp(JSON.parse(s));
    } catch {
      return /^\d{4,8}$/.test(s) ? s : null;
    }
  }

  if (typeof v === "number") {
    const s = String(v).trim();
    return /^\d{4,8}$/.test(s) ? s : null;
  }

  if (typeof v === "object") {
    const obj = v as Record<string, unknown>;

    const directCandidates = [obj.otp, obj.smsOtp, obj.otpKeyOtp, obj.code, obj.value];
    for (const candidate of directCandidates) {
      const parsed = normalizeOtp(candidate);
      if (parsed) return parsed;
    }

    const nestedCandidates = [obj.msg, obj.data, obj.smsLatest, obj.payload];
    for (const candidate of nestedCandidates) {
      const parsed = normalizeOtp(candidate);
      if (parsed) return parsed;
    }
  }

  return null;
}


function buildRedisKey(phone: string) {
  return `${ENV.OTP_REDIS_KEY_PREFIX}${String(phone || "").trim()}`;
}

async function tryGetUpstashOtp(phone: string): Promise<DebugOtpResult> {
  const upstashUrl = String(ENV.UPSTASH_REDIS_REST_URL || "").replace(/\/$/, "");
  const upstashToken = String(ENV.UPSTASH_REDIS_REST_TOKEN || "").trim();
  const key = buildRedisKey(phone);

  if (!upstashUrl || !upstashToken) {
    return {
      otp: null,
      source: "none",
      pathTried: "upstash",
      reason: "upstash_not_configured",
    };
  }

  const url = `${upstashUrl}/get/${encodeURIComponent(key)}`;
  const response = await fetch(url, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${upstashToken}`,
    },
  });

  const contentType = response.headers.get("content-type") || "";
  let raw: any = null;

  if (contentType.includes("application/json")) {
    raw = await response.json();
  } else {
    raw = await response.text();
  }

  const resultValue = raw && typeof raw === "object" ? raw.result : null;
  const otp = normalizeOtp(resultValue);

  return {
    otp,
    source: otp ? "upstash" : "none",
    httpStatus: response.status,
    pathTried: url,
    reason: otp ? "ok" : "no_otp",
    raw,
  };
}


export async function getOtpViaAuthServiceDebug(phone: string, headers: any): Promise<DebugOtpResult> {
  try {
    return await tryGetUpstashOtp(phone);
  } catch (err: any) {
    return {
      otp: null,
      source: "none",
      pathTried: "upstash",
      reason: err?.message || String(err),
    };
  }
}

export async function waitForOtpViaAuthServiceDebug(
  phone: string,
  headers: any,
  timeoutMs: number = ENV.OTP_TIMEOUT_MS,
  pollMs: number = ENV.OTP_POLL_MS,
  logger?: Logger
): Promise<DebugOtpResult> {
  const start = Date.now();
  let attempts = 0;

  logger?.debug?.({ timeoutMs, pollMs }, "OTP_POLL_LOOP_BEGIN");

  while (Date.now() - start < timeoutMs) {
    attempts++;
    let out: DebugOtpResult;
    try {
      out = await getOtpViaAuthServiceDebug(phone, headers);
    } catch (err: any) {
      out = { otp: null, source: "none", reason: err?.message || String(err) };
      logger?.error?.({ attempts, err }, "OTP_POLL_EXCEPTION");
    }

    const shouldLogTick = ENV.LOG_VERBOSE || attempts === 1 || attempts % 10 === 0;
    if (shouldLogTick) {
      logger?.debug?.(
        {
          attempts,
          elapsedMs: Date.now() - start,
          source: out.source,
          httpStatus: out.httpStatus,
          pathTried: out.pathTried,
          hasOtp: !!out.otp,
          reason: out.reason,
          body: out.raw,
        },
        "OTP_POLL_TICK"
      );
    }

    if (out.otp) {
      logger?.info?.(
        {
          attempts,
          elapsedMs: Date.now() - start,
          source: out.source,
          httpStatus: out.httpStatus,
          pathTried: out.pathTried,
        },
        "OTP_POLL_GOT_OTP"
      );
      return out;
    }

    await new Promise((r) => setTimeout(r, pollMs));
  }

  logger?.warn?.({ attempts, elapsedMs: Date.now() - start }, "OTP_POLL_TIMEOUT");
  return { otp: null, source: "none", reason: "timeout" };
}