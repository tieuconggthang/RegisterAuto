import { ENV } from "../config/env";
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
  loadCsvRecords
} from "../utils/csv-helpers";

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

function buildRequestHeaders(deviceId: string) {
  return buildHeaders(deviceId);
}


export async function registerFromCsv(filePath: string, ctx: WorkerCtx) {
  const { logId, logger } = ctx;
  const records = loadCsvRecords(filePath);

  const otpTimeout = Number(ENV.OTP_TIMEOUT_MS ?? 60_000);
  const otpPoll = Number(ENV.OTP_POLL_MS ?? 500);
  const verifyRetry = Number(ENV.OTP_VERIFY_RETRY ?? 5);

  let success = 0;
  let pending = 0;
  let fail = 0;
  let skipped = 0;

  const seenPhones = new Set<string>();

  for (let i = 0; i < records.length; i++) {
    const row = records[i];
    const deviceId = generateDeviceId();
    const { valid, phone, reason } = validateRow(row, seenPhones);

    if (!valid || !phone) {
      skipped++;
      logger.warn({ row: i + 1, reason }, "ROW_SKIPPED");
      continue;
    }

    seenPhones.add(phone);
    const l = logger.child ? logger.child({ row: i + 1, phone }) : logger;

    try {
      const headers = buildRequestHeaders(deviceId);
      const payload = buildPayload(row, phone);
      const resp = await registerUser(payload, headers);
      const registerApi = parseApiRes(resp?.data);

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
      const otpRec = await waitForOtpViaAuthServiceDebug(phone, headers, otpTimeout, otpPoll, l);
      if (!otpRec?.otp) {
        pending++;
        const userId = await findUserIdByPhone(phone).catch(() => null);
        await insertUserAction({ userId: (typeof userId === 'number' ? userId : null), actionName: "REGISTER", detail: "PENDING_OTP", logId });
        l.warn({}, "PENDING_OTP");
        continue;
      }

      const otp = String(otpRec.otp);

      // Verify
      let verified = false;
      let lastMsg = "";

      for (let attempt = 1; attempt <= verifyRetry; attempt++) {
        const vResp = await verifyRegisterOtpApi(phone, otp, headers);
        const vApi = parseApiRes(vResp?.data);
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
      const userId = await findUserIdByPhone(phone).catch(() => null);
      const uid = (typeof userId === 'number' ? userId : null);

      await insertAuthStatus({ action: "REGISTER", phone, deviceId, userId: uid, status: 1, detail: "SUCCESS", logId });
      await insertUserAction({ userId: uid, actionName: "REGISTER", detail: "SUCCESS", logId });

      l.info({}, "REGISTER_OK");

    } catch (err: any) {
      fail++;
      const msg = err?.message || String(err);
      l.error({ err: msg }, "ROW_FAIL");


      try {
        const userId = await findUserIdByPhone(phone).catch(() => null);
        const uid = (typeof userId === 'number' ? userId : null);
        await insertAuthStatus({ action: "REGISTER", phone, deviceId, userId: uid, status: 0, detail: msg, logId });
      } catch { }
    }
  }

  logger.info({ success, pending, fail, skipped }, "CSV_SUMMARY");
  return { success, pending, fail, skipped };
}
