"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildHeaders = buildHeaders;
const env_1 = require("../config/env");
const RANDOM_USER_AGENTS = [
    "ERIC/1.0.0 (iOS; 18.6.2; iPhone 16 Plus)",
    "ERIC/1.0.0 (iOS; 17.5.1; iPhone 15 Pro Max)",
    "ERIC/1.1.0 (Android; 14; Galaxy S24 Ultra)",
    "ERIC/1.2.0 (Android; 13; Oppo Find X6)"
];
function getRandomUserAgent() {
    // If the user modified the base .env and specifically wanted a custom agent, use it.
    const defaultAgent = "ERIC/1.0.0 (iOS; 18.6.2; iPhone 16 Plus)";
    if (env_1.ENV.USER_AGENT !== defaultAgent) {
        return env_1.ENV.USER_AGENT;
    }
    const randomIndex = Math.floor(Math.random() * RANDOM_USER_AGENTS.length);
    return RANDOM_USER_AGENTS[randomIndex];
}
function buildHeaders(deviceId, clientType = "mobile") {
    return {
        "Accept": "application/json",
        "Accept-Encoding": "gzip, br",
        "Accept-Language": "vi",
        "Content-Type": "application/json",
        "X-Client-Type": clientType,
        "X-Device-Id": deviceId,
        "User-Agent": getRandomUserAgent(),
        "X-Forwarded-Proto": "https",
    };
}
//# sourceMappingURL=headers.js.map