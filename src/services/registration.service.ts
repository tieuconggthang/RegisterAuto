import fs from "fs";
import path from "path";
import { ENV } from "../config/env";
import {
    registerUser,
    validateUsername,
    verifyRegisterOtpWithPayload,
    parseApiRes,
} from "../api/auth.api";
import { waitForOtpViaAuthServiceDebug } from "./otp-authservice.service";
import { type CsvRow, buildPayload } from "../utils/csv-helpers";
import { safeJson } from "../utils/logMask";
import { type AppLogger } from "./register-csv.worker";

export class RegistrationService {
    private readonly otpTimeout: number;
    private readonly otpPoll: number;
    private readonly verifyRetry: number;

    constructor() {
        this.otpTimeout = Number(ENV.OTP_TIMEOUT_MS ?? 60_000);
        this.otpPoll = Number(ENV.OTP_POLL_MS ?? 500);
        this.verifyRetry = Number(ENV.OTP_VERIFY_RETRY ?? 5);
    }

    async executeRegistrationFlow(
        row: CsvRow,
        index: number,
        identifier: string,
        phone: string | undefined,
        deviceId: string,
        headers: any,
        logger: AppLogger
    ): Promise<{ status: "success" | "pending" | "fail", error?: string }> {
        try {
            const validateHeaders = { ...headers, "X-Client-Type": "web" };

            // 1) VALIDATE
            const vResp = await validateUsername(identifier, validateHeaders);
            const vApi = parseApiRes(vResp?.data);

            console.log(`🔎 VALIDATE [${identifier}] status=${vResp?.status}`);
            console.log(`🔎 VALIDATE [${identifier}] body=${JSON.stringify(safeJson(vResp?.data, 300))}`);

            logger.debug?.(
                { row: index + 1, identifier, phone, status: vResp?.status, body: vResp?.data },
                "VALIDATE_USERNAME_RESPONSE"
            );

            if (vApi?.isSucceed) {
                console.log(`🟢 VALIDATE OK: ${identifier}`);
            } else {
                console.log(`🟡 VALIDATE FAIL nhưng vẫn tiếp tục flow: ${identifier}`);
            }

            // 2) REGISTER
            const payload = buildPayload(row, identifier);
            const resp = await registerUser(payload, headers);
            const registerApi = parseApiRes(resp?.data);
            const registerStatus = Number(resp?.status || 0);

            console.log(`📨 REGISTER [${identifier}] status=${registerStatus}`);
            console.log(`📨 REGISTER [${identifier}] body=${JSON.stringify(safeJson(resp?.data, 300))}`);

            logger.debug?.(
                {
                    row: index + 1,
                    identifier,
                    phone,
                    status: registerStatus,
                    body: resp?.data,
                    headers: resp?.headers,
                },
                "REGISTER_API_RESPONSE"
            );

            let shouldContinueAfterRegister = false;

            if (registerApi?.isSucceed) {
                shouldContinueAfterRegister = true;
                console.log(`🟢 REGISTER OK: ${identifier}`);
            } else if (registerStatus === 409 && ENV.REGISTER_CONTINUE_ON_409) {
                shouldContinueAfterRegister = true;
                console.log(`🟡 REGISTER trả 409, vẫn tiếp tục flow: ${identifier}`);
            } else if (!registerApi) {
                throw new Error(`REGISTER_BAD_RESPONSE_HTTP_${registerStatus}`);
            } else {
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

            const otpRec = await waitForOtpViaAuthServiceDebug(
                phone,
                headers,
                this.otpTimeout,
                this.otpPoll,
                logger
            );

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

        } catch (err: any) {
            const errorMsg = err?.message || String(err);

            logger.error?.(
                { row: index + 1, identifier, phone, error: errorMsg },
                "REGISTER_ROW_FAIL"
            );

            console.log(`❌ REGISTER FAIL [${identifier}]: ${errorMsg}`);
            return { status: "fail", error: errorMsg };
        }
    }

    private async verifyOtp(identifier: string, phone: string | undefined, otp: string, headers: any, logger: AppLogger) {
        let lastMsg = "";
        const attempts: Array<{ label: string; payload: any }> = [];

        if (phone) {
            attempts.push({ label: "phone", payload: { phone, otp } });
        }

        attempts.push({ label: "username", payload: { username: identifier, otp } });

        for (const verifyAttempt of attempts) {
            for (let attempt = 1; attempt <= this.verifyRetry; attempt++) {
                const vResp = await verifyRegisterOtpWithPayload(verifyAttempt.payload, headers);
                const vApi = parseApiRes(vResp?.data);

                console.log(
                    `🔐 VERIFY [${identifier}] field=${verifyAttempt.label} attempt=${attempt} status=${vResp?.status}`
                );
                console.log(`🔐 VERIFY [${identifier}] body=${JSON.stringify(safeJson(vResp?.data, 300))}`);

                logger.debug?.(
                    {
                        identifier,
                        phone,
                        verifyField: verifyAttempt.label,
                        attempt,
                        status: vResp?.status,
                        body: vResp?.data,
                    },
                    "VERIFY_REGISTER_OTP_RESPONSE"
                );

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

    private saveSuccessRecord(phone: string, username: string, deviceId: string, userAgent: string) {
        try {
            const outputPath = path.resolve(process.cwd(), "success_accounts.csv");
            const isNewFile = !fs.existsSync(outputPath);

            if (isNewFile) {
                fs.writeFileSync(outputPath, "Phone,Username,Device ID,User Agent\n", "utf8");
            }

            const cleanUserAgent = `"${userAgent.replace(/"/g, '""')}"`;
            const record = `${phone},${username},${deviceId},${cleanUserAgent}\n`;

            fs.appendFileSync(outputPath, record, "utf8");
            console.log(`💾 Đã lưu thông tin tài khoản thành công vào success_accounts.csv`);
        } catch (err: any) {
            console.log(`⚠️ Lỗi khi lưu success_accounts.csv: ${err?.message}`);
        }
    }
}
