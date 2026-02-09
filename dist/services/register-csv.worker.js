"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RegisterCsvWorker = void 0;
const env_1 = require("../config/env");
const log_1 = require("../utils/log");
const device_1 = require("../utils/device");
const auth_api_1 = require("../api/auth.api");
const otp_authservice_service_1 = require("./otp-authservice.service");
const audit_repo_1 = require("../repo/audit.repo");
const headers_1 = require("../utils/headers");
const csv_helpers_1 = require("../utils/csv-helpers");
/* ================= WORKER CLASS ================= */
class RegisterCsvWorker {
    constructor(ctx) {
        this.logger = log_1.Log.getLogger("RegisterCsvWorker");
        this.success = 0;
        this.pending = 0;
        this.fail = 0;
        this.skipped = 0;
        this.seenPhones = new Set();
        this.logId = ctx.logId;
        this.appLLoger = ctx.logger;
        this.otpTimeout = Number(env_1.ENV.OTP_TIMEOUT_MS ?? 60000);
        this.otpPoll = Number(env_1.ENV.OTP_POLL_MS ?? 500);
        this.verifyRetry = Number(env_1.ENV.OTP_VERIFY_RETRY ?? 5);
    }
    /* ================= PUBLIC API ================= */
    async run(filePath) {
        const records = (0, csv_helpers_1.loadCsvRecords)(filePath);
        for (let i = 0; i < records.length; i++) {
            await this.processRow(records[i], i);
        }
        this.logger.info("CSV_SUMMARY", {
            success: this.success,
            pending: this.pending,
            fail: this.fail,
            skipped: this.skipped,
        });
        return {
            success: this.success,
            pending: this.pending,
            fail: this.fail,
            skipped: this.skipped,
        };
    }
    /* ================= INTERNAL ================= */
    buildRequestHeaders(deviceId) {
        return (0, headers_1.buildHeaders)(deviceId);
    }
    async processRow(row, index) {
        const deviceId = (0, device_1.generateDeviceId)();
        const { valid, phone, reason } = (0, csv_helpers_1.validateRow)(row, this.seenPhones);
        if (!valid || !phone) {
            this.skipped++;
            this.logger.warn("ROW_SKIPPED", {
                row: index + 1,
                reason,
            });
            return;
        }
        this.seenPhones.add(phone);
        try {
            const headers = this.buildRequestHeaders(deviceId);
            const payload = (0, csv_helpers_1.buildPayload)(row, phone);
            const resp = await (0, auth_api_1.registerUser)(payload, headers);
            const registerApi = (0, csv_helpers_1.parseApiRes)(resp?.data);
            if (!registerApi) {
                throw new Error("REGISTER_BAD_RESPONSE");
            }
            if (!registerApi.isSucceed) {
                const msg = registerApi.message ?? "REGISTER_FAILED";
                if (msg.toLowerCase().includes("exists")) {
                    this.skipped++;
                    this.logger.warn("ROW_SKIPPED", {
                        row: index + 1,
                        reason,
                    });
                    ;
                    return;
                }
                throw new Error(`REGISTER_FAIL: ${msg}`);
            }
            // Wait OTP
            const otpRec = await (0, otp_authservice_service_1.waitForOtpViaAuthServiceDebug)(phone, headers, this.otpTimeout, this.otpPoll, this.appLLoger);
            if (!otpRec?.otp) {
                this.pending++;
                await this.auditPending(phone);
                this.logger.warn("PENDING_OTP");
                return;
            }
            await this.verifyOtp(phone, String(otpRec.otp), headers);
            this.success++;
            await this.auditSuccess(phone, deviceId);
            this.logger.info("REGISTER_OK");
        }
        catch (err) {
            this.fail++;
            const msg = err?.message || String(err);
            this.logger.error("ROW_FAIL", err);
            // log.error({ err: msg }, "ROW_FAIL");
            await this.auditFail(phone, deviceId, msg);
        }
    }
    async verifyOtp(phone, otp, headers) {
        let lastMsg = "";
        for (let attempt = 1; attempt <= this.verifyRetry; attempt++) {
            const vResp = await (0, auth_api_1.verifyRegisterOtpApi)(phone, otp, headers);
            const vApi = (0, csv_helpers_1.parseApiRes)(vResp?.data);
            if (vApi?.isSucceed)
                return;
            lastMsg = vApi?.message || "VERIFY_FAILED";
        }
        throw new Error(`VERIFY_FAIL_AFTER_RETRY: ${lastMsg}`);
    }
    /* ================= AUDIT ================= */
    async auditPending(phone) {
        const userId = await (0, audit_repo_1.findUserIdByPhone)(phone).catch(() => null);
        await (0, audit_repo_1.insertUserAction)({
            userId: typeof userId === "number" ? userId : null,
            actionName: "REGISTER",
            detail: "PENDING_OTP",
            logId: this.logId,
        });
    }
    async auditSuccess(phone, deviceId) {
        const userId = await (0, audit_repo_1.findUserIdByPhone)(phone).catch(() => null);
        const uid = typeof userId === "number" ? userId : null;
        await (0, audit_repo_1.insertAuthStatus)({
            action: "REGISTER",
            phone,
            deviceId,
            userId: uid,
            status: 1,
            detail: "SUCCESS",
            logId: this.logId,
        });
        await (0, audit_repo_1.insertUserAction)({
            userId: uid,
            actionName: "REGISTER",
            detail: "SUCCESS",
            logId: this.logId,
        });
    }
    async auditFail(phone, deviceId, msg) {
        const userId = await (0, audit_repo_1.findUserIdByPhone)(phone).catch(() => null);
        await (0, audit_repo_1.insertAuthStatus)({
            action: "REGISTER",
            phone,
            deviceId,
            userId: typeof userId === "number" ? userId : null,
            status: 0,
            detail: msg,
            logId: this.logId,
        });
    }
}
exports.RegisterCsvWorker = RegisterCsvWorker;
//# sourceMappingURL=register-csv.worker.js.map