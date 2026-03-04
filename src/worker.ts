import fs from "fs";
import path from "path";
import { ENV } from "./config/env";
import { cleanupOldLogs, getTodayLogPath } from "./config/logFile";
import { createFileLogger } from "./config/logger";
import { RegisterCsvWorker } from "./services/register-csv.worker";

let isRunning = false;
let watchTimer: NodeJS.Timeout | null = null;
let started = false;

function resolveCsvPath() {
  return path.resolve(process.cwd(), ENV.CSV_PATH);
}

async function runOnce(reason: string) {
  if (isRunning) {
    console.log(`⏭️ Bỏ qua runOnce(${reason}) vì job đang chạy.`);
    return;
  }

  isRunning = true;
  const csvPath = resolveCsvPath();

  try {
    cleanupOldLogs();

    const { filePath } = getTodayLogPath();
    const baseLogger = createFileLogger(filePath);
    const logger = baseLogger.child({ logId: -1 });

    if (!started) {
      started = true;
      console.log("📦 Worker config:", {
        csvPath,
        runOnce: ENV.RUN_ONCE,
        intervalMs: ENV.INTERVAL_MS,
        concurrency: ENV.CONCURRENCY,
        otpTimeoutMs: ENV.OTP_TIMEOUT_MS,
        otpPollMs: ENV.OTP_POLL_MS,
      });
    }

    const exists = fs.existsSync(csvPath);
    console.log(`📄 CSV path: ${csvPath} | exists=${exists}`);

    const worker = new RegisterCsvWorker({
      logId: -1,
      logger,
    });

    const reg = await worker.run(csvPath);

    console.log(
      `REGISTER summary: success=${reg.success} pending=${reg.pending} fail=${reg.fail} skipped=${reg.skipped}`
    );
  } catch (err: any) {
    console.error("❌ runOnce crash:", err?.stack || err?.message || err);
  } finally {
    isRunning = false;
  }
}

export async function startWorker() {
  const csvPath = resolveCsvPath();

  console.log("🟢 startWorker()");
  console.log("   cwd =", process.cwd());
  console.log("   csv =", csvPath);
  console.log("   RUN_ONCE =", ENV.RUN_ONCE);

  await runOnce("startup");

  if (ENV.RUN_ONCE) {
    console.log("🏁 RUN_ONCE=true nên process sẽ kết thúc sau lần chạy đầu.");
    return;
  }

  setInterval(() => {
    runOnce("interval").catch((err) => {
      console.error("❌ interval run fail:", err?.message || err);
    });
  }, ENV.INTERVAL_MS);

  console.log(`⏲️ Interval đã được bật: ${ENV.INTERVAL_MS}ms`);

  if (fs.existsSync(csvPath)) {
    fs.watch(csvPath, (eventType) => {
      if (eventType === "change") {
        if (watchTimer) clearTimeout(watchTimer);
        watchTimer = setTimeout(() => {
          runOnce("csv changed").catch((err) => {
            console.error("❌ csv changed run fail:", err?.message || err);
          });
        }, 1200);
      }
    });

    console.log("👀 Đang watch file CSV...");
  } else {
    console.warn(`⚠️ Không tìm thấy CSV tại startup: ${csvPath}`);
  }
}