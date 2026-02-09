"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.startWorker = startWorker;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const env_1 = require("./config/env");
const logFile_1 = require("./config/logFile");
const log_repo_1 = require("./repo/log.repo");
const logger_1 = require("./config/logger");
const register_csv_worker_1 = require("./services/register-csv.worker");
let isRunning = false;
let watchTimer = null;
let started = false;
function resolveCsvPath() {
    return path_1.default.resolve(process.cwd(), env_1.ENV.CSV_PATH);
}
async function runOnce(reason) {
    if (isRunning) {
        try {
            const { filePath } = (0, logFile_1.getTodayLogPath)();
            const logger = (0, logger_1.createFileLogger)(filePath);
            logger.warn({ reason }, "JOB_SKIPPED_ALREADY_RUNNING");
        }
        catch {
        }
        return;
    }
    isRunning = true;
    const csvPath = resolveCsvPath();
    try {
        (0, logFile_1.cleanupOldLogs)();
        const { fileName, filePath } = (0, logFile_1.getTodayLogPath)();
        const baseLogger = (0, logger_1.createFileLogger)(filePath);
        let logId = -1;
        try {
            logId = await (0, log_repo_1.ensureLogRow)(fileName, filePath);
        }
        catch (err) {
            baseLogger.error({ err }, "LOG_ROW_UPSERT_FAIL");
        }
        const logger = baseLogger.child({ logId });
        if (!started) {
            started = true;
            logger.info({
                config: {
                    BASE_URL: env_1.ENV.BASE_URL,
                    CSV_PATH: env_1.ENV.CSV_PATH,
                    INTERVAL_MS: env_1.ENV.INTERVAL_MS,
                    RUN_ONCE: env_1.ENV.RUN_ONCE,
                    OTP_TIMEOUT_MS: env_1.ENV.OTP_TIMEOUT_MS,
                    OTP_POLL_MS: env_1.ENV.OTP_POLL_MS,
                    OTP_VERIFY_RETRY: env_1.ENV.OTP_VERIFY_RETRY,
                    OTP_DEBUG_PATH_PENDING: env_1.ENV.OTP_DEBUG_PATH_PENDING,
                    OTP_DEBUG_PATH_REDIS: env_1.ENV.OTP_DEBUG_PATH_REDIS,
                    LOG_LEVEL: env_1.ENV.LOG_LEVEL,
                    LOG_VERBOSE: env_1.ENV.LOG_VERBOSE,
                    LOG_HTTP: env_1.ENV.LOG_HTTP,
                },
            }, "WORKER_CONFIG");
        }
        let st = null;
        try {
            st = fs_1.default.existsSync(csvPath) ? fs_1.default.statSync(csvPath) : null;
        }
        catch {
            st = null;
        }
        logger.info({
            reason,
            csvPath,
            csvExists: !!st,
            csvSize: st?.size,
            csvMtimeMs: st?.mtimeMs,
        }, "JOB_START");
        const ctx = { logId, logger };
        // const reg = await registerFromCsv(csvPath, ctx);
        /*Anh Thangtc sua de toi gian code*/
        const worker = new register_csv_worker_1.RegisterCsvWorker({ logId, logger });
        const reg = await worker.run(csvPath);
        logger.info({ reg }, "JOB_DONE");
        console.log(`REGISTER summary: success=${reg.success} pending=${reg.pending} fail=${reg.fail}`);
    }
    catch (err) {
        try {
            const { filePath } = (0, logFile_1.getTodayLogPath)();
            const logger = (0, logger_1.createFileLogger)(filePath);
            logger.error({ reason, csvPath, err }, "JOB_CRASH");
        }
        catch {
            // ignore
        }
        console.log("REGISTER summary: success=0 pending=0 fail=0");
    }
    finally {
        isRunning = false;
    }
}
async function startWorker() {
    const csvPath = resolveCsvPath();
    await runOnce("startup");
    if (env_1.ENV.RUN_ONCE)
        return;
    setInterval(() => runOnce("interval"), env_1.ENV.INTERVAL_MS);
    if (fs_1.default.existsSync(csvPath)) {
        try {
            const { filePath } = (0, logFile_1.getTodayLogPath)();
            const logger = (0, logger_1.createFileLogger)(filePath);
            logger.info({ csvPath }, "CSV_WATCH_START");
        }
        catch {
        }
        fs_1.default.watch(csvPath, (eventType) => {
            if (eventType === "change") {
                if (watchTimer)
                    clearTimeout(watchTimer);
                watchTimer = setTimeout(() => runOnce("csv changed"), 1200);
            }
        });
    }
    else {
        try {
            const { filePath } = (0, logFile_1.getTodayLogPath)();
            const logger = (0, logger_1.createFileLogger)(filePath);
            logger.warn({ csvPath }, "CSV_NOT_FOUND_AT_STARTUP");
        }
        catch {
            // ignore
        }
    }
}
//# sourceMappingURL=worker.js.map