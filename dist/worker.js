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
        console.log(`⏭️ Bỏ qua runOnce(${reason}) vì job đang chạy.`);
        return;
    }
    isRunning = true;
    const csvPath = resolveCsvPath();
    try {
        (0, logFile_1.cleanupOldLogs)();
        const { filePath } = (0, logFile_1.getTodayLogPath)();
        const baseLogger = (0, logger_1.createFileLogger)(filePath);
        const logger = baseLogger.child({ logId: -1 });
        if (!started) {
            started = true;
            console.log("📦 Worker config:", {
                csvPath,
                runOnce: env_1.ENV.RUN_ONCE,
                intervalMs: env_1.ENV.INTERVAL_MS,
                concurrency: env_1.ENV.CONCURRENCY,
                otpTimeoutMs: env_1.ENV.OTP_TIMEOUT_MS,
                otpPollMs: env_1.ENV.OTP_POLL_MS,
            });
        }
        const exists = fs_1.default.existsSync(csvPath);
        console.log(`📄 CSV path: ${csvPath} | exists=${exists}`);
        const worker = new register_csv_worker_1.RegisterCsvWorker({
            logId: -1,
            logger,
        });
        const reg = await worker.run(csvPath);
        console.log(`REGISTER summary: success=${reg.success} pending=${reg.pending} fail=${reg.fail} skipped=${reg.skipped}`);
    }
    catch (err) {
        console.error("❌ runOnce crash:", err?.stack || err?.message || err);
    }
    finally {
        isRunning = false;
    }
}
async function startWorker() {
    const csvPath = resolveCsvPath();
    console.log("🟢 startWorker()");
    console.log("   cwd =", process.cwd());
    console.log("   csv =", csvPath);
    console.log("   RUN_ONCE =", env_1.ENV.RUN_ONCE);
    await runOnce("startup");
    if (env_1.ENV.RUN_ONCE) {
        console.log("🏁 RUN_ONCE=true nên process sẽ kết thúc sau lần chạy đầu.");
        return;
    }
    setInterval(() => {
        runOnce("interval").catch((err) => {
            console.error("❌ interval run fail:", err?.message || err);
        });
    }, env_1.ENV.INTERVAL_MS);
    console.log(`⏲️ Interval đã được bật: ${env_1.ENV.INTERVAL_MS}ms`);
    if (fs_1.default.existsSync(csvPath)) {
        fs_1.default.watch(csvPath, (eventType) => {
            if (eventType === "change") {
                if (watchTimer)
                    clearTimeout(watchTimer);
                watchTimer = setTimeout(() => {
                    runOnce("csv changed").catch((err) => {
                        console.error("❌ csv changed run fail:", err?.message || err);
                    });
                }, 1200);
            }
        });
        console.log("👀 Đang watch file CSV...");
    }
    else {
        console.warn(`⚠️ Không tìm thấy CSV tại startup: ${csvPath}`);
    }
}
//# sourceMappingURL=worker.js.map