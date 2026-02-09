"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createFileLogger = createFileLogger;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const pino_1 = __importDefault(require("pino"));
const env_1 = require("./env");
function createFileLogger(filePath) {
    fs_1.default.mkdirSync(path_1.default.dirname(filePath), { recursive: true });
    const destination = pino_1.default.destination({ dest: filePath, sync: false });
    return (0, pino_1.default)({
        base: null,
        level: env_1.ENV.LOG_LEVEL,
        timestamp: pino_1.default.stdTimeFunctions.isoTime,
        messageKey: "msg",
        serializers: {
            err: pino_1.default.stdSerializers.err,
        },
    }, destination);
}
//# sourceMappingURL=logger.js.map