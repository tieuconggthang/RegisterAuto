"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerUser = registerUser;
exports.verifyRegisterOtpApi = verifyRegisterOtpApi;
exports.resendRegisterOtpApi = resendRegisterOtpApi;
exports.getDebugOtpFromAuthService = getDebugOtpFromAuthService;
exports.getDebugRedisOtpFromAuthService = getDebugRedisOtpFromAuthService;
const axios_1 = __importDefault(require("axios"));
const env_1 = require("../config/env");
function normalizePhone(raw) {
    let p = String(raw || "").trim();
    p = p.replace(/\D/g, "");
    return p;
}
async function registerUser(payload, headers) {
    const body = {
        ...payload,
        phone: normalizePhone(payload.phone),
    };
    return axios_1.default.post(`${env_1.ENV.BASE_URL}/auth/register`, body, {
        headers,
        validateStatus: () => true,
        timeout: 60000,
    });
}
async function verifyRegisterOtpApi(phone, otp, headers) {
    return axios_1.default.post(`${env_1.ENV.BASE_URL}/auth/verify-register-otp`, { phone: normalizePhone(phone), otp: String(otp || "").trim() }, {
        headers,
        validateStatus: () => true,
        timeout: 60000,
    });
}
async function resendRegisterOtpApi(phone, headers) {
    return axios_1.default.post(`${env_1.ENV.BASE_URL}/auth/resend-otp-register`, { phone: normalizePhone(phone) }, {
        headers,
        validateStatus: () => true,
        timeout: 60000,
    });
}
async function getDebugOtpFromAuthService(phone, headers) {
    const p = normalizePhone(phone);
    return axios_1.default.get(`${env_1.ENV.BASE_URL}${env_1.ENV.OTP_DEBUG_PATH_PENDING}`, {
        params: { phone: p },
        headers,
        validateStatus: () => true,
    });
}
async function getDebugRedisOtpFromAuthService(phone, headers) {
    const p = normalizePhone(phone);
    return axios_1.default.get(`${env_1.ENV.BASE_URL}${env_1.ENV.OTP_DEBUG_PATH_REDIS}`, {
        params: { phone: p },
        headers,
        validateStatus: () => true,
    });
}
//# sourceMappingURL=auth.api.js.map