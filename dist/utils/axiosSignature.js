"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getSignature = void 0;
exports.applySignatureInterceptor = applySignatureInterceptor;
const crypto_1 = __importDefault(require("crypto"));
const crypto_2 = require("crypto");
const getSignature = (rawData, token) => {
    return crypto_1.default.createHmac("sha256", token).update(rawData).digest("base64");
};
exports.getSignature = getSignature;
function applySignatureInterceptor(axiosInstance) {
    axiosInstance.interceptors.request.use((config) => {
        const method = config.method ? String(config.method).toUpperCase() : "GET";
        let requestPath = config.url || "";
        if (requestPath.startsWith("http")) {
            const urlObj = new URL(requestPath);
            requestPath = urlObj.pathname + urlObj.search;
        }
        let body = "";
        if (config.data && typeof config.data === "object") {
            body = config.data.constructor?.name === "FormData" ? "" : JSON.stringify(config.data);
        }
        else {
            body = config.data || "";
        }
        const timestamp = Math.floor(Date.now() / 1000).toString();
        config.headers = config.headers || {};
        let authHeader = "";
        for (const key of Object.keys(config.headers)) {
            if (key.toLowerCase() === "authorization") {
                authHeader = config.headers[key];
                break;
            }
        }
        let token = "";
        if (authHeader && typeof authHeader === "string") {
            token = authHeader.replace(/^Bearer\s+/i, "").trim();
        }
        if (requestPath.includes("/auth/") || requestPath.includes("/password/")) {
            token = "";
        }
        const rawData = method + "|" + requestPath + "|" + timestamp + "|" + body;
        const signature = (0, exports.getSignature)(rawData, token);
        if (typeof config.headers.set === "function") {
            config.headers.set("X-Timestamp", timestamp);
            config.headers.set("X-Signature", signature);
            if (!config.headers.has("Idempotency-Key")) {
                config.headers.set("Idempotency-Key", (0, crypto_2.randomUUID)());
            }
        }
        else {
            config.headers["X-Timestamp"] = timestamp;
            config.headers["X-Signature"] = signature;
            if (!config.headers["Idempotency-Key"]) {
                config.headers["Idempotency-Key"] = (0, crypto_2.randomUUID)();
            }
        }
        return config;
    }, (error) => Promise.reject(error));
}
//# sourceMappingURL=axiosSignature.js.map