"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ENV = void 0;
const path_1 = __importDefault(require("path"));
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config({
    path: path_1.default.resolve(process.cwd(), ".env"),
    override: false,
    debug: false,
    quiet: true,
});
function num(v, def) {
    const n = Number(v);
    return Number.isFinite(n) ? n : def;
}
function str(v, def) {
    const s = String(v ?? "").trim();
    return s ? s : def;
}
function bool(v, def) {
    if (v === undefined || v === null)
        return def;
    const s = String(v).trim().toLowerCase();
    if (s === "true" || s === "1" || s === "yes" || s === "y")
        return true;
    if (s === "false" || s === "0" || s === "no" || s === "n")
        return false;
    return def;
}
exports.ENV = {
    BASE_URL: str(process.env.BASE_URL, "http://localhost:3001"),
    KONG_URL: str(process.env.KONG_URL, str(process.env.BASE_URL, "http://localhost:3001")),
    CSV_PATH: str(process.env.CSV_PATH, "users.csv"),
    INTERVAL_MS: num(process.env.INTERVAL_MS, 60000),
    CONCURRENCY: num(process.env.CONCURRENCY, 5),
    RUN_ONCE: bool(process.env.RUN_ONCE, false),
    DEVICE_ID: str(process.env.DEVICE_ID, ""),
    USER_AGENT: str(process.env.USER_AGENT, "ERIC/1.0.0 (iOS; 18.6.2; iPhone 16 Plus)"),
    OTP_TIMEOUT_MS: num(process.env.OTP_TIMEOUT_MS, 60000),
    OTP_POLL_MS: num(process.env.OTP_POLL_MS, 500),
    OTP_VERIFY_RETRY: num(process.env.OTP_VERIFY_RETRY, 5),
    OTP_REDIS_KEY_PREFIX: str(process.env.OTP_REDIS_KEY_PREFIX, "eric_"),
    REGISTER_CONTINUE_ON_409: bool(process.env.REGISTER_CONTINUE_ON_409, true),
    UPSTASH_REDIS_REST_URL: str(process.env.UPSTASH_REDIS_REST_URL, ""),
    UPSTASH_REDIS_REST_TOKEN: str(process.env.UPSTASH_REDIS_REST_TOKEN, ""),
    LOG_RETENTION_DAYS: num(process.env.LOG_RETENTION_DAYS, 7),
    LOG_LEVEL: str(process.env.LOG_LEVEL, "debug"),
    LOG_VERBOSE: bool(process.env.LOG_VERBOSE, true),
    LOG_HTTP: bool(process.env.LOG_HTTP, true),
    LOG_OTP_PLAINTEXT: bool(process.env.LOG_OTP_PLAINTEXT, false),
    LOG_PASSWORD_PLAINTEXT: bool(process.env.LOG_PASSWORD_PLAINTEXT, false),
};
//# sourceMappingURL=env.js.map