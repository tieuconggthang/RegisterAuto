import { ENV } from "../config/env";
import { Log } from "../utils/log";
import { generateDeviceId } from "../utils/device";
import {
    registerUser,
    verifyRegisterOtpApi,
} from "../api/auth.api";
import {
    waitForOtpViaAuthServiceDebug,
} from "./otp-authservice.service";
import {
    findUserIdByPhone,
    insertAuthStatus,
    insertUserAction,
} from "../repo/audit.repo";
import { buildHeaders } from "../utils/headers";
import {
    type CsvRow,
    parseApiRes,
    validateRow,
    buildPayload,
    loadCsvRecords,
} from "../utils/csv-helpers";

/* ================= LOGGER & CONTEXT ================= */

export type AppLogger = {
    info: (obj: any, msg?: string) => void;
    warn: (obj: any, msg?: string) => void;
    error: (obj: any, msg?: string) => void;
    debug: (obj: any, msg?: string) => void;
    child?: (obj: any) => AppLogger;
};

export type WorkerCtx = {
    logId: number;
    logger: AppLogger;
};

/* ================= WORKER CLASS ================= */

export class RegisterCsvWorker {
    private readonly appLLoger: AppLogger;
    private readonly logger = Log.getLogger("RegisterCsvWorker");
    private readonly logId: number
    private readonly otpTimeout: number;
    private readonly otpPoll: number;
    private readonly verifyRetry: number;

    private success = 0;
    private pending = 0;
    private fail = 0;
    private skipped = 0;

    private readonly seenPhones = new Set<string>();

    constructor(ctx: WorkerCtx) {
        this.logId = ctx.logId;
        this.appLLoger = ctx.logger
        this.otpTimeout = Number(ENV.OTP_TIMEOUT_MS ?? 60_000);
        this.otpPoll = Number(ENV.OTP_POLL_MS ?? 500);
        this.verifyRetry = Number(ENV.OTP_VERIFY_RETRY ?? 5);
    }

    /* ================= PUBLIC API ================= */

    async run(filePath: string) {
        const records = loadCsvRecords(filePath);

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

    private buildRequestHeaders(deviceId: string) {
        return buildHeaders(deviceId);
    }

    private async processRow(row: CsvRow, index: number) {
        const deviceId = generateDeviceId();
        const { valid, phone, reason } = validateRow(row, this.seenPhones);

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
            const payload = buildPayload(row, phone);

            const resp = await registerUser(payload, headers);
            const registerApi = parseApiRes(resp?.data);

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
                    });;
                    return;
                }
                throw new Error(`REGISTER_FAIL: ${msg}`);
            }

            // Wait OTP
            const otpRec = await waitForOtpViaAuthServiceDebug(
                phone,
                headers,
                this.otpTimeout,
                this.otpPoll,
                this.appLLoger
            );

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

        } catch (err: any) {
            this.fail++;
            const msg = err?.message || String(err);
            this.logger.error("ROW_FAIL", err)
            // log.error({ err: msg }, "ROW_FAIL");
            await this.auditFail(phone, deviceId, msg);
        }
    }

    private async verifyOtp(phone: string, otp: string, headers: any) {
        let lastMsg = "";

        for (let attempt = 1; attempt <= this.verifyRetry; attempt++) {
            const vResp = await verifyRegisterOtpApi(phone, otp, headers);
            const vApi = parseApiRes(vResp?.data);

            if (vApi?.isSucceed) return;
            lastMsg = vApi?.message || "VERIFY_FAILED";
        }

        throw new Error(`VERIFY_FAIL_AFTER_RETRY: ${lastMsg}`);
    }

    /* ================= AUDIT ================= */

    private async auditPending(phone: string) {
        const userId = await findUserIdByPhone(phone).catch(() => null);
        await insertUserAction({
            userId: typeof userId === "number" ? userId : null,
            actionName: "REGISTER",
            detail: "PENDING_OTP",
            logId: this.logId,
        });
    }

    private async auditSuccess(phone: string, deviceId: string) {
        const userId = await findUserIdByPhone(phone).catch(() => null);
        const uid = typeof userId === "number" ? userId : null;

        await insertAuthStatus({
            action: "REGISTER",
            phone,
            deviceId,
            userId: uid,
            status: 1,
            detail: "SUCCESS",
            logId: this.logId,
        });

        await insertUserAction({
            userId: uid,
            actionName: "REGISTER",
            detail: "SUCCESS",
            logId: this.logId,
        });
    }

    private async auditFail(phone: string, deviceId: string, msg: string) {
        const userId = await findUserIdByPhone(phone).catch(() => null);
        await insertAuthStatus({
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
