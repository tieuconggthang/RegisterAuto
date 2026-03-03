"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const axios_1 = __importDefault(require("axios"));
const env_1 = require("./config/env");
const PHONE = "0961493196";
async function debugOtp() {
    try {
        const url = `${env_1.ENV.BASE_URL}/auth/debug/redis-otp`;
        console.log(`Calling ${url} for phone: ${PHONE}`);
        const res = await axios_1.default.get(url, {
            params: { phone: PHONE }, // Match auth.api.ts
            validateStatus: () => true
        });
        console.log("Status:", res.status);
        console.log("Data:", JSON.stringify(res.data, null, 2));
    }
    catch (err) {
        console.error("Error:", err.message);
    }
}
debugOtp();
//# sourceMappingURL=debug-otp-direct.js.map