"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateDeviceId = generateDeviceId;
const crypto_1 = require("crypto");
function generateDeviceId() {
    return (0, crypto_1.randomUUID)();
}
//# sourceMappingURL=device.js.map