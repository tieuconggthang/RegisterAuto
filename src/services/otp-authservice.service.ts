import { ENV } from "../config/env";
import {
  getDebugRedisOtpFromAuthService,
  type ApiRes,
} from "../api/auth.api";

export type DebugOtpResult = {
  otp: string | null;
  source: "pending" | "redis" | "none";
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
  const s = String(v).trim();
  return s ? s : null;
}

function parseApiRes(body: any): ApiRes | null {
  if (!body || typeof body !== "object") return null;
  if (typeof body.isSucceed === "boolean") return body as ApiRes;
  return null;
}



async function tryGetRedisOtp(phone: string, headers: any): Promise<DebugOtpResult> {
  const resp = await getDebugRedisOtpFromAuthService(phone, headers);
  if (!resp || resp.status >= 400) {
    return {
      otp: null,
      source: "none",
      httpStatus: resp?.status,
      pathTried: ENV.OTP_DEBUG_PATH_REDIS,
      reason: `http_${resp?.status}`,
      raw: resp?.data,
    };
  }

  const api = parseApiRes(resp.data);
  const otp = normalizeOtp((api as any)?.data?.otp);
  const msg = (api as any)?.message;
  return {
    otp,
    source: otp ? "redis" : "none",
    httpStatus: resp.status,
    pathTried: ENV.OTP_DEBUG_PATH_REDIS,
    reason: otp ? "ok" : (typeof msg === "string" ? msg : "no_otp"),
    raw: resp.data,
  };
}

export async function getOtpViaAuthServiceDebug(phone: string, headers: any): Promise<DebugOtpResult> {
  let pending: DebugOtpResult | null = null;
  let redis: DebugOtpResult | null = null;
  try {
    redis = await tryGetRedisOtp(phone, headers);
    if (redis.otp) return redis;
  } catch (err: any) {
    redis = { otp: null, source: "none", pathTried: ENV.OTP_DEBUG_PATH_REDIS, reason: err?.message || String(err) };
  }

  return redis?.pathTried ? redis : (pending || { otp: null, source: "none" });
}

export async function waitForOtpViaAuthServiceDebug(
  phone: string,
  headers: any,
  timeoutMs: number = ENV.OTP_TIMEOUT_MS,
  pollMs: number = ENV.OTP_POLL_MS
  ,
  logger?: Logger
): Promise<DebugOtpResult> {
  const start = Date.now();
  let lastOtp: string | null = null;
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

    if (out.otp && out.otp !== lastOtp) {
      logger?.info?.(
        { attempts, elapsedMs: Date.now() - start, source: out.source, httpStatus: out.httpStatus, pathTried: out.pathTried },
        "OTP_POLL_GOT_OTP"
      );
      return out;
    }

    await new Promise((r) => setTimeout(r, pollMs));
  }

  logger?.warn?.({ attempts, elapsedMs: Date.now() - start }, "OTP_POLL_TIMEOUT");
  return { otp: null, source: "none", reason: "timeout" };
}