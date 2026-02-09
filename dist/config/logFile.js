"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ensureLogDir = ensureLogDir;
exports.getTodayLogPath = getTodayLogPath;
exports.cleanupOldLogs = cleanupOldLogs;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const env_1 = require("./env");
function ensureLogDir() {
    const dir = path_1.default.resolve(process.cwd(), "data", "logs");
    fs_1.default.mkdirSync(dir, { recursive: true });
    return dir;
}
function getTodayLogPath() {
    const dir = ensureLogDir();
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    const fileName = `worker-${yyyy}-${mm}-${dd}.log`;
    return {
        fileName,
        filePath: path_1.default.join(dir, fileName),
    };
}
function cleanupOldLogs() {
    const dir = ensureLogDir();
    const keepMs = env_1.ENV.LOG_RETENTION_DAYS * 24 * 60 * 60 * 1000;
    const now = Date.now();
    for (const f of fs_1.default.readdirSync(dir)) {
        const full = path_1.default.join(dir, f);
        try {
            const st = fs_1.default.statSync(full);
            if (st.isFile() && now - st.mtimeMs > keepMs) {
                fs_1.default.unlinkSync(full);
            }
        }
        catch {
            // ignore
        }
    }
}
//# sourceMappingURL=logFile.js.map