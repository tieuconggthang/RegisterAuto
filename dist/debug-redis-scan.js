"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const axios_1 = __importDefault(require("axios"));
const env_1 = require("./config/env");
const PHONE = "0961493196";
async function scan() {
    try {
        const url = `${env_1.ENV.BASE_URL}/auth/debug/redis-scan`;
        console.log(`Scanning Redis via ${url} for number: ${PHONE}`);
        const res = await axios_1.default.get(url, {
            params: { contains: PHONE },
            validateStatus: () => true
        });
        console.log("Status:", res.status);
        console.log("Data:", JSON.stringify(res.data, null, 2));
    }
    catch (err) {
        console.error("Error:", err.message);
    }
}
scan();
//# sourceMappingURL=debug-redis-scan.js.map