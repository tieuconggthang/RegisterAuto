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
async function waitForOtpViaAuthServiceDebug(phone, headers, timeoutMs = env_1.ENV.OTP_TIMEOUT_MS, pollMs = env_1.ENV.OTP_POLL_MS, logger, minTimestamp = 0) {
    const start = Date.now();
    let lastOtp = null;
    let attempts = 0;
    while (Date.now() - start < timeoutMs) {
        attempts++;
        let out;
        try {
            out = await getOtpViaAuthServiceDebug(phone, headers);
        }
        catch (err) {
            out = { otp: null, source: "none", reason: err?.message || String(err) };
        }
        const shouldLogTick = env_1.ENV.LOG_VERBOSE || attempts === 1 || attempts % 10 === 0;
        if (out.otp) {
            let isFresh = true;
            let ts = 0;
            const rawData = out.raw?.data;
            const msg = rawData?.msg;
            if (msg?.receivedAt) {
                ts = new Date(msg.receivedAt).getTime();
            }
            else if (msg?.timestamp) {
                ts = Number(msg.timestamp);
            }
            if (out.otp !== lastOtp || attempts % 10 === 0) {
                if (logger) {
                    logger.info({
                        phone,
                        otp: out.otp,
                        tsRaw: msg?.receivedAt || msg?.timestamp,
                        tsParsed: ts,
                        minTs: minTimestamp,
                        isFresh: (minTimestamp === 0 || ts >= minTimestamp),
                        serverTime: new Date().toISOString()
                    }, "OTP_POLL_DEBUG");
                }
            }
            if (minTimestamp > 0 && ts > 0 && ts < minTimestamp) {
                if (logger) {
                    logger.warn({ otp: out.otp, ts: new Date(ts).toISOString() }, "OTP_OLD_ACCEPTED_BY_USER_REQUEST");
                }
            }
            if (isFresh) {
                if (out.otp !== lastOtp) {
                    return out;
                }
            }
            lastOtp = out.otp;
        }
        await new Promise((r) => setTimeout(r, pollMs));
    }
    return { otp: null, source: "none", reason: "timeout" };
}
//# sourceMappingURL=otp-authservice.service.js.map