"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.RegistrationService = void 0;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const env_1 = require("../config/env");
const auth_api_1 = require("../api/auth.api");
const otp_authservice_service_1 = require("./otp-authservice.service");
const csv_helpers_1 = require("../utils/csv-helpers");
const logMask_1 = require("../utils/logMask");
class RegistrationService {
    constructor() {
        this.otpTimeout = Number(env_1.ENV.OTP_TIMEOUT_MS ?? 60000);
        this.otpPoll = Number(env_1.ENV.OTP_POLL_MS ?? 500);
        this.verifyRetry = Number(env_1.ENV.OTP_VERIFY_RETRY ?? 5);
    }
    async executeRegistrationFlow(row, index, identifier, phone, deviceId, headers, logger) {
        try {
            const validateHeaders = { ...headers, "X-Client-Type": "web" };
            // 1) VALIDATE
            const vResp = await (0, auth_api_1.validateUsername)(identifier, validateHeaders);
            const vApi = (0, auth_api_1.parseApiRes)(vResp?.data);
            console.log(`🔎 VALIDATE [${identifier}] status=${vResp?.status}`);
            console.log(`🔎 VALIDATE [${identifier}] body=${JSON.stringify((0, logMask_1.safeJson)(vResp?.data, 300))}`);
            logger.debug?.({ row: index + 1, identifier, phone, status: vResp?.status, body: vResp?.data }, "VALIDATE_USERNAME_RESPONSE");
            if (vApi?.isSucceed) {
                console.log(`🟢 VALIDATE OK: ${identifier}`);
            }
            else {
                console.log(`🟡 VALIDATE FAIL nhưng vẫn tiếp tục flow: ${identifier}`);
            }
            // 2) REGISTER
            const payload = (0, csv_helpers_1.buildPayload)(row, identifier);
            const resp = await (0, auth_api_1.registerUser)(payload, headers);
            const registerApi = (0, auth_api_1.parseApiRes)(resp?.data);
            const registerStatus = Number(resp?.status || 0);
            console.log(`📨 REGISTER [${identifier}] status=${registerStatus}`);
            console.log(`📨 REGISTER [${identifier}] body=${JSON.stringify((0, logMask_1.safeJson)(resp?.data, 300))}`);
            logger.debug?.({
                row: index + 1,
                identifier,
                phone,
                status: registerStatus,
                body: resp?.data,
                headers: resp?.headers,
            }, "REGISTER_API_RESPONSE");
            let shouldContinueAfterRegister = false;
            if (registerApi?.isSucceed) {
                shouldContinueAfterRegister = true;
                console.log(`🟢 REGISTER OK: ${identifier}`);
            }
            else if (registerStatus === 409 && env_1.ENV.REGISTER_CONTINUE_ON_409) {
                shouldContinueAfterRegister = true;
                console.log(`🟡 REGISTER trả 409, vẫn tiếp tục flow: ${identifier}`);
            }
            else if (!registerApi) {
                throw new Error(`REGISTER_BAD_RESPONSE_HTTP_${registerStatus}`);
            }
            else {
                throw new Error(`REGISTER_FAIL: ${registerApi.message ?? "REGISTER_FAILED"}`);
            }
            if (!shouldContinueAfterRegister) {
                throw new Error("REGISTER_NOT_CONTINUED");
            }
            // 3) LẤY OTP
            if (!phone) {
                console.log(`⏳ KHÔNG CÓ PHONE nên chưa lấy được OTP Redis cho identifier=${identifier}`);
                return { status: "pending" };
            }
            const otpRec = await (0, otp_authservice_service_1.waitForOtpViaAuthServiceDebug)(phone, headers, this.otpTimeout, this.otpPoll, logger);
            if (!otpRec?.otp) {
                console.log(`⏳ PENDING OTP: identifier=${identifier}, phone=${phone}`);
                return { status: "pending" };
            }
            console.log(`🔑 OTP FOUND [${identifier}] phone=${phone}: ${otpRec.otp}`);
            // 4) VERIFY
            await this.verifyOtp(identifier, phone, String(otpRec.otp), headers, logger);
            // 5) SAVE METADATA
            this.saveSuccessRecord(phone, identifier, deviceId, headers["User-Agent"]);
            console.log(`✅ REGISTER SUCCESS: ${identifier}`);
            return { status: "success" };
        }
        catch (err) {
            const errorMsg = err?.message || String(err);
            logger.error?.({ row: index + 1, identifier, phone, error: errorMsg }, "REGISTER_ROW_FAIL");
            console.log(`❌ REGISTER FAIL [${identifier}]: ${errorMsg}`);
            return { status: "fail", error: errorMsg };
        }
    }
    async verifyOtp(identifier, phone, otp, headers, logger) {
        let lastMsg = "";
        const attempts = [];
        if (phone) {
            attempts.push({ label: "phone", payload: { phone, otp } });
        }
        attempts.push({ label: "username", payload: { username: identifier, otp } });
        for (const verifyAttempt of attempts) {
            for (let attempt = 1; attempt <= this.verifyRetry; attempt++) {
                const vResp = await (0, auth_api_1.verifyRegisterOtpWithPayload)(verifyAttempt.payload, headers);
                const vApi = (0, auth_api_1.parseApiRes)(vResp?.data);
                console.log(`🔐 VERIFY [${identifier}] field=${verifyAttempt.label} attempt=${attempt} status=${vResp?.status}`);
                console.log(`🔐 VERIFY [${identifier}] body=${JSON.stringify((0, logMask_1.safeJson)(vResp?.data, 300))}`);
                logger.debug?.({
                    identifier,
                    phone,
                    verifyField: verifyAttempt.label,
                    attempt,
                    status: vResp?.status,
                    body: vResp?.data,
                }, "VERIFY_REGISTER_OTP_RESPONSE");
                if (vApi?.isSucceed) {
                    console.log(`🟢 VERIFY OK [${identifier}] bằng ${verifyAttempt.label}`);
                    return;
                }
                const status = Number(vResp?.status || 0);
                if (status >= 500) {
                    lastMsg = `SERVER_ERROR_${status}: ${vApi?.message || ""}`;
                    console.log(`❌ Dừng Retry VERIFY vì Server trả về lỗi ${status}: ${lastMsg}`);
                    break; // Don't retry this field if it's a hard server error 
                }
                lastMsg = vApi?.message || `VERIFY_FAILED_${verifyAttempt.label}`;
            }
        }
        throw new Error(`VERIFY_FAIL_AFTER_RETRY: ${lastMsg}`);
    }
    saveSuccessRecord(phone, username, deviceId, userAgent) {
        try {
            const outputPath = path_1.default.resolve(process.cwd(), "success_accounts.csv");
            const isNewFile = !fs_1.default.existsSync(outputPath);
            if (isNewFile) {
                fs_1.default.writeFileSync(outputPath, "Phone,Username,Device ID,User Agent\n", "utf8");
            }
            const cleanUserAgent = `"${userAgent.replace(/"/g, '""')}"`;
            const record = `${phone},${username},${deviceId},${cleanUserAgent}\n`;
            fs_1.default.appendFileSync(outputPath, record, "utf8");
            console.log(`💾 Đã lưu thông tin tài khoản thành công vào success_accounts.csv`);
        }
        catch (err) {
            console.log(`⚠️ Lỗi khi lưu success_accounts.csv: ${err?.message}`);
        }
    }
}
exports.RegistrationService = RegistrationService;
//# sourceMappingURL=registration.service.js.map