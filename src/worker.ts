import fs from "fs";
import path from "path";
import { ENV } from "./config/env";
import { cleanupOldLogs, getTodayLogPath } from "./config/logFile";
import { ensureLogRow } from "./repo/log.repo";
import { createFileLogger } from "./config/logger";
import { registerFromCsv } from "./services/register-from-csv.service";
import { RegisterCsvWorker } from "./services/register-csv.worker";

let isRunning = false;
let watchTimer: NodeJS.Timeout | null = null;
let started = false;

function resolveCsvPath() {
  return path.resolve(process.cwd(), ENV.CSV_PATH);
}

async function runOnce(reason: string) {
  if (isRunning) {
    try {
      const { filePath } = getTodayLogPath();
      const logger = createFileLogger(filePath);
      logger.warn({ reason }, "JOB_SKIPPED_ALREADY_RUNNING");
    } catch {
   
    }
    return;
  }
  isRunning = true;

  const csvPath = resolveCsvPath();

  try {
    cleanupOldLogs();

    const { fileName, filePath } = getTodayLogPath();

    const baseLogger = createFileLogger(filePath);
    let logId = -1;
    try {
      logId = await ensureLogRow(fileName, filePath);
    } catch (err: any) {
      baseLogger.error({ err }, "LOG_ROW_UPSERT_FAIL");
    }

    const logger = baseLogger.child({ logId });

    if (!started) {
      started = true;
      logger.info(
        {
          config: {
            BASE_URL: ENV.BASE_URL,
            CSV_PATH: ENV.CSV_PATH,
            INTERVAL_MS: ENV.INTERVAL_MS,
            RUN_ONCE: ENV.RUN_ONCE,
            OTP_TIMEOUT_MS: ENV.OTP_TIMEOUT_MS,
            OTP_POLL_MS: ENV.OTP_POLL_MS,
            OTP_VERIFY_RETRY: ENV.OTP_VERIFY_RETRY,
            OTP_DEBUG_PATH_PENDING: ENV.OTP_DEBUG_PATH_PENDING,
            OTP_DEBUG_PATH_REDIS: ENV.OTP_DEBUG_PATH_REDIS,
            LOG_LEVEL: ENV.LOG_LEVEL,
            LOG_VERBOSE: ENV.LOG_VERBOSE,
            LOG_HTTP: (ENV as any).LOG_HTTP,
          },
        },
        "WORKER_CONFIG"
      );
    }

    let st: fs.Stats | null = null;
    try {
      st = fs.existsSync(csvPath) ? fs.statSync(csvPath) : null;
    } catch {
      st = null;
    }

    logger.info(
      {
        reason,
        csvPath,
        csvExists: !!st,
        csvSize: st?.size,
        csvMtimeMs: st?.mtimeMs,
      },
      "JOB_START"
    );

    const ctx = { logId, logger };

    // const reg = await registerFromCsv(csvPath, ctx);
    /*Anh Thangtc sua de toi gian code*/

    const worker = new RegisterCsvWorker({ logId, logger });
    const reg = await worker.run(csvPath);
    logger.info({ reg }, "JOB_DONE");

    console.log(
      `REGISTER summary: success=${reg.success} pending=${reg.pending} fail=${reg.fail}`
    );
  } catch (err: any) {
    try {
      const { filePath } = getTodayLogPath();
      const logger = createFileLogger(filePath); 
      logger.error({ reason, csvPath, err }, "JOB_CRASH");
    } catch {
      // ignore
    }
    console.log("REGISTER summary: success=0 pending=0 fail=0");
  } finally {
    isRunning = false;
  }
}

export async function startWorker() {
  const csvPath = resolveCsvPath();

  await runOnce("startup");

  if (ENV.RUN_ONCE) return;

  setInterval(() => runOnce("interval"), ENV.INTERVAL_MS);

  if (fs.existsSync(csvPath)) {
    
    try {
      const { filePath } = getTodayLogPath();
      const logger = createFileLogger(filePath); 
      logger.info({ csvPath }, "CSV_WATCH_START");
    } catch {
    }

    fs.watch(csvPath, (eventType) => {
      if (eventType === "change") {
        if (watchTimer) clearTimeout(watchTimer);
        watchTimer = setTimeout(() => runOnce("csv changed"), 1200);
      }
    });
  } else {
    try {
      const { filePath } = getTodayLogPath();
      const logger = createFileLogger(filePath); 
      logger.warn({ csvPath }, "CSV_NOT_FOUND_AT_STARTUP");
    } catch {
      // ignore
    }
  }
}
