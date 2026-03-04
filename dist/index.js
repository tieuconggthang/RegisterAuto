"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const worker_1 = require("./worker");
console.log("🚀 Starting RegisterAuto...");
(0, worker_1.startWorker)()
    .then(() => {
    console.log("✅ startWorker() đã được gọi xong.");
})
    .catch((err) => {
    console.error("❌ Worker crashed:", err?.stack || err?.message || err);
    process.exit(1);
});
//# sourceMappingURL=index.js.map