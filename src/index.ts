import { startWorker } from "./worker";

console.log("🚀 Starting RegisterAuto...");

startWorker()
  .then(() => {
    console.log("✅ startWorker() đã được gọi xong.");
  })
  .catch((err) => {
    console.error("❌ Worker crashed:", err?.stack || err?.message || err);
    process.exit(1);
  });