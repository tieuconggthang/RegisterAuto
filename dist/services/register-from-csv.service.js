"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerFromCsv = registerFromCsv;
const env_1 = require("../config/env");
const device_1 = require("../utils/device");
const auth_api_1 = require("../api/auth.api");
const otp_authservice_service_1 = require("./otp-authservice.service");
const audit_repo_1 = require("../repo/audit.repo");
const headers_1 = require("../utils/headers");
const csv_helpers_1 = require("../utils/csv-helpers");
function buildRequestHeaders(deviceId) {
    return (0, headers_1.buildHeaders)(deviceId);
}
async function registerFromCsv(filePath, ctx) {
    const { logId, logger } = ctx;
    const records = (0, csv_helpers_1.loadCsvRecords)(filePath);
    const otpTimeout = Number(env_1.ENV.OTP_TIMEOUT_MS ?? 60000);
    const otpPoll = Number(env_1.ENV.OTP_POLL_MS ?? 500);
    const verifyRetry = Number(env_1.ENV.OTP_VERIFY_RETRY ?? 5);
    let success = 0;
    let pending = 0;
    let fail = 0;
    let skipped = 0;
    const seenPhones = new Set();
    for (let i = 0; i < records.length; i++) {
        const row = records[i];
        const deviceId = (0, device_1.generateDeviceId)();
        const { valid, phone, reason } = (0, csv_helpers_1.validateRow)(row, seenPhones);
        if (!valid || !phone) {
            skipped++;
            logger.warn({ row: i + 1, reason }, "ROW_SKIPPED");
            continue;
        }
        seenPhones.add(phone);
        const l = logger.child ? logger.child({ row: i + 1, phone }) : logger;
        try {
            const headers = buildRequestHeaders(deviceId);
            const payload = (0, csv_helpers_1.buildPayload)(row, phone);
            const resp = await (0, auth_api_1.registerUser)(payload, headers);
            const registerApi = (0, csv_helpers_1.parseApiRes)(resp?.data);
            if (!registerApi) {
                throw new Error("REGISTER_BAD_RESPONSE");
            }
            if (!registerApi.isSucceed) {
                const msg = registerApi.message ?? "REGISTER_FAILED";
                if (msg.toLowerCase().includes("exists")) {
                    skipped++;
                    l.warn({ message: msg }, "REGISTER_EXISTS");
                    continue;
                }
                throw new Error(`REGISTER_FAIL: ${msg}`);
            }
            // Wait for OTP
            const otpRec = await (0, otp_authservice_service_1.waitForOtpViaAuthServiceDebug)(phone, headers, otpTimeout, otpPoll, l);
            if (!otpRec?.otp) {
                pending++;
                const userId = await (0, audit_repo_1.findUserIdByPhone)(phone).catch(() => null);
                await (0, audit_repo_1.insertUserAction)({ userId: (typeof userId === 'number' ? userId : null), actionName: "REGISTER", detail: "PENDING_OTP", logId });
                l.warn({}, "PENDING_OTP");
                continue;
            }
            const otp = String(otpRec.otp);
            // Verify
            let verified = false;
            let lastMsg = "";
            for (let attempt = 1; attempt <= verifyRetry; attempt++) {
                const vResp = await (0, auth_api_1.verifyRegisterOtpApi)(phone, otp, headers);
                const vApi = (0, csv_helpers_1.parseApiRes)(vResp?.data);
                if (vApi?.isSucceed) {
                    verified = true;
                    break;
                }
                lastMsg = vApi?.message || "VERIFY_FAILED";
            }
            if (!verified) {
                throw new Error(`VERIFY_FAIL_AFTER_RETRY: ${lastMsg}`);
            }
            success++;
            const userId = await (0, audit_repo_1.findUserIdByPhone)(phone).catch(() => null);
            const uid = (typeof userId === 'number' ? userId : null);
            await (0, audit_repo_1.insertAuthStatus)({ action: "REGISTER", phone, deviceId, userId: uid, status: 1, detail: "SUCCESS", logId });
            await (0, audit_repo_1.insertUserAction)({ userId: uid, actionName: "REGISTER", detail: "SUCCESS", logId });
            l.info({}, "REGISTER_OK");
        }
        catch (err) {
            fail++;
            const msg = err?.message || String(err);
            l.error({ err: msg }, "ROW_FAIL");
            try {
                const userId = await (0, audit_repo_1.findUserIdByPhone)(phone).catch(() => null);
                const uid = (typeof userId === 'number' ? userId : null);
                await (0, audit_repo_1.insertAuthStatus)({ action: "REGISTER", phone, deviceId, userId: uid, status: 0, detail: msg, logId });
            }
            catch { }
        }
    }
    logger.info({ success, pending, fail, skipped }, "CSV_SUMMARY");
    return { success, pending, fail, skipped };
}
//# sourceMappingURL=register-from-csv.service.js.map