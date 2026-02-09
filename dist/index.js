"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const worker_1 = require("./worker");
(0, worker_1.startWorker)().catch((err) => {
    console.error("❌ Worker crashed:", err?.message || err);
    process.exit(1);
});
//# sourceMappingURL=index.js.map