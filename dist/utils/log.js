"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Log = void 0;
const pino_1 = __importDefault(require("pino"));
class Log {
    /* ================= INIT (như logback.xml) ================= */
    static init(opts) {
        if (this.initialized)
            return;
        this.root = (0, pino_1.default)({
            level: opts?.level ?? process.env.LOG_LEVEL ?? "info",
            base: {
                app: opts?.appName ?? "app",
                env: opts?.env ?? process.env.NODE_ENV ?? "dev",
                logId: opts?.logId ?? Date.now(),
            },
            timestamp: pino_1.default.stdTimeFunctions.isoTime,
        });
        this.initialized = true;
    }
    /* ================= LOGGER FACTORY ================= */
    static getLogger(name) {
        if (!this.initialized) {
            this.init(); // auto-init an toàn
        }
        const logger = this.root.child({ logger: name });
        return {
            debug: (msg, obj) => logger.debug(obj, msg),
            info: (msg, obj) => logger.info(obj, msg),
            warn: (msg, obj) => logger.warn(obj, msg),
            error: (msg, obj) => logger.error(obj, msg),
        };
    }
}
exports.Log = Log;
Log.initialized = false;
//# sourceMappingURL=log.js.map