"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getOtpViaAuthServiceDebug = getOtpViaAuthServiceDebug;
exports.waitForOtpViaAuthServiceDebug = waitForOtpViaAuthServiceDebug;
const env_1 = require("../config/env");
const auth_api_1 = require("../api/auth.api");
function normalizeOtp(v) {
    if (v == null)
        return null;
    const s = String(v).trim();
    return s ? s : null;
}
function parseApiRes(body) {
    if (!body || typeof body !== "object")
        return null;
    if (typeof body.isSucceed === "boolean")
        return body;
    return null;
}
async function tryGetRedisOtp(phone, headers) {
    const resp = await (0, auth_api_1.getDebugRedisOtpFromAuthService)(phone, headers);
    if (!resp || resp.status >= 400) {
        return {
            otp: null,
            source: "none",
            httpStatus: resp?.status,
            pathTried: env_1.ENV.OTP_DEBUG_PATH_REDIS,
            reason: `http_${resp?.status}`,
            raw: resp?.data,
        };
    }
    const api = parseApiRes(resp.data);
    const otp = normalizeOtp(api?.data?.otp);
    const msg = api?.message;
    return {
        otp,
        source: otp ? "redis" : "none",
        httpStatus: resp.status,
        pathTried: env_1.ENV.OTP_DEBUG_PATH_REDIS,
        reason: otp ? "ok" : (typeof msg === "string" ? msg : "no_otp"),
        raw: resp.data,
    };
}
async function getOtpViaAuthServiceDebug(phone, headers) {
    let pending = null;
    let redis = null;
    try {
        redis = await tryGetRedisOtp(phone, headers);
        if (redis.otp)
            return redis;
    }
    catch (err) {
        redis = { otp: null, source: "none", pathTried: env_1.ENV.OTP_DEBUG_PATH_REDIS, reason: err?.message || String(err) };
    }
    return redis?.pathTried ? redis : (pending || { otp: null, source: "none" });
}
async function waitForOtpViaAuthServiceDebug(phone, headers, timeoutMs = env_1.ENV.OTP_TIMEOUT_MS, pollMs = env_1.ENV.OTP_POLL_MS, logger) {
    const start = Date.now();
    let lastOtp = null;
    let attempts = 0;
    logger?.debug?.({ timeoutMs, pollMs }, "OTP_POLL_LOOP_BEGIN");
    while (Date.now() - start < timeoutMs) {
        attempts++;
        let out;
        try {
            out = await getOtpViaAuthServiceDebug(phone, headers);
        }
        catch (err) {
            out = { otp: null, source: "none", reason: err?.message || String(err) };
            logger?.error?.({ attempts, err }, "OTP_POLL_EXCEPTION");
        }
        const shouldLogTick = env_1.ENV.LOG_VERBOSE || attempts === 1 || attempts % 10 === 0;
        if (shouldLogTick) {
            logger?.debug?.({
                attempts,
                elapsedMs: Date.now() - start,
                source: out.source,
                httpStatus: out.httpStatus,
                pathTried: out.pathTried,
                hasOtp: !!out.otp,
                reason: out.reason,
                body: out.raw,
            }, "OTP_POLL_TICK");
        }
        if (out.otp && out.otp !== lastOtp) {
            logger?.info?.({ attempts, elapsedMs: Date.now() - start, source: out.source, httpStatus: out.httpStatus, pathTried: out.pathTried }, "OTP_POLL_GOT_OTP");
            return out;
        }
        await new Promise((r) => setTimeout(r, pollMs));
    }
    logger?.warn?.({ attempts, elapsedMs: Date.now() - start }, "OTP_POLL_TIMEOUT");
    return { otp: null, source: "none", reason: "timeout" };
}
//# sourceMappingURL=otp-authservice.service.js.map