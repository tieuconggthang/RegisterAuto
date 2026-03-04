"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseApiRes = parseApiRes;
exports.validateUsername = validateUsername;
exports.registerUser = registerUser;
exports.verifyRegisterOtpWithPayload = verifyRegisterOtpWithPayload;
exports.verifyRegisterOtpApi = verifyRegisterOtpApi;
exports.resendRegisterOtpWithPayload = resendRegisterOtpWithPayload;
exports.resendRegisterOtpApi = resendRegisterOtpApi;
const axios_1 = __importDefault(require("axios"));
const env_1 = require("../config/env");
const axiosSignature_1 = require("../utils/axiosSignature");
const phone_1 = require("../utils/phone");
function parseApiRes(body) {
    if (!body || typeof body !== "object")
        return null;
    if (typeof body.isSucceed === "boolean")
        return body;
    return null;
}
const authHttp = axios_1.default.create({
    baseURL: env_1.ENV.KONG_URL,
    timeout: 20000,
    headers: {
        "Content-Type": "application/json",
        "Accept": "application/json",
        "X-Client-Type": "mobile",
        "User-Agent": env_1.ENV.USER_AGENT,
        "X-Forwarded-Proto": "https",
    },
    validateStatus: () => true,
});
(0, axiosSignature_1.applySignatureInterceptor)(authHttp);
async function validateUsername(username, headers) {
    return authHttp.post("/api/auth/validate-username", { username }, { headers });
}
async function registerUser(payload, headers) {
    const body = {
        ...payload,
        username: (0, phone_1.normalizePhone)(payload.username),
    };
    return authHttp.post("/api/auth/register", body, { headers });
}
async function verifyRegisterOtpWithPayload(payload, headers) {
    const body = {
        phone: payload.phone ? (0, phone_1.normalizePhone)(payload.phone) : undefined,
        username: payload.username ? String(payload.username).trim() : undefined,
        otp: String(payload.otp || "").trim(),
    };
    return authHttp.post("/api/auth/verify-register-otp", body, { headers });
}
async function verifyRegisterOtpApi(phone, otp, headers) {
    return verifyRegisterOtpWithPayload({ phone, otp }, headers);
}
async function resendRegisterOtpWithPayload(payload, headers) {
    const body = {
        phone: payload.phone ? (0, phone_1.normalizePhone)(payload.phone) : undefined,
        username: payload.username ? String(payload.username).trim() : undefined,
    };
    return authHttp.post("/api/auth/resend-otp-register", body, { headers });
}
async function resendRegisterOtpApi(phone, headers) {
    return resendRegisterOtpWithPayload({ phone }, headers);
}
//# sourceMappingURL=auth.api.js.map