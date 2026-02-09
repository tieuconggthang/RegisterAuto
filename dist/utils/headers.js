"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildHeaders = buildHeaders;
const crypto_1 = require("crypto");
function buildHeaders(deviceId) {
    return {
        "Content-Type": "application/json",
        "X-Device-Id": deviceId,
        "X-Client-Type": "web",
        "Accept-Language": "vi",
        "Idempotency-Key": (0, crypto_1.randomUUID)()
    };
}
//# sourceMappingURL=headers.js.map