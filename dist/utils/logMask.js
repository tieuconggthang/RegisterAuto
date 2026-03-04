"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.normalizePhone = void 0;
exports.maskOtp = maskOtp;
exports.maskPassword = maskPassword;
exports.safeJson = safeJson;
const env_1 = require("../config/env");
function maskOtp(otp) {
    if (otp == null)
        return null;
    const s = String(otp).trim();
    if (!s)
        return null;
    if (env_1.ENV.LOG_OTP_PLAINTEXT)
        return s;
    if (s.length <= 2)
        return "**";
    return "***" + s.slice(-2);
}
function maskPassword(pw) {
    if (pw == null)
        return null;
    const s = String(pw);
    if (env_1.ENV.LOG_PASSWORD_PLAINTEXT)
        return s;
    return `***len=${s.length}`;
}
var phone_1 = require("./phone");
Object.defineProperty(exports, "normalizePhone", { enumerable: true, get: function () { return phone_1.normalizePhone; } });
function safeJson(obj, maxLen = 2000) {
    // keep logs small
    if (obj == null)
        return obj;
    try {
        const s = JSON.stringify(obj);
        if (s.length <= maxLen)
            return obj;
        return { truncated: true, length: s.length, preview: s.slice(0, maxLen) };
    }
    catch {
        return String(obj);
    }
}
//# sourceMappingURL=logMask.js.map