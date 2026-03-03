"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv_1 = require("dotenv");
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const auth_api_1 = require("./api/auth.api");
(0, dotenv_1.config)({ path: path_1.default.join(__dirname, "../config/.env") });
async function main() {
    const results = {};
    const phone = "0987000005";
    console.log(`Checking OTP for ${phone}...`);
    try {
        const res = await (0, auth_api_1.getDebugRedisOtpFromAuthService)(phone, {});
        results[phone] = { status: res.status, data: res.data };
    }
    catch (err) {
        results[phone] = {
            error: err.message,
            data: err.response?.data,
            status: err.response?.status
        };
    }
    const phone84 = "84987000005";
    console.log(`Checking OTP for ${phone84}...`);
    try {
        const res = await (0, auth_api_1.getDebugRedisOtpFromAuthService)(phone84, {});
        results[phone84] = { status: res.status, data: res.data };
    }
    catch (err) {
        results[phone84] = {
            error: err.message,
            data: err.response?.data,
            status: err.response?.status
        };
    }
    fs_1.default.writeFileSync("debug-otp-out.json", JSON.stringify(results, null, 2));
    console.log("Written to debug-otp-out.json");
}
main();
//# sourceMappingURL=debug-otp.js.map