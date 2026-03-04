"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RegisterCsvWorker = void 0;
const env_1 = require("../config/env");
const device_1 = require("../utils/device");
const headers_1 = require("../utils/headers");
const csv_helpers_1 = require("../utils/csv-helpers");
const registration_service_1 = require("./registration.service");
class RegisterCsvWorker {
    constructor(ctx) {
        this.success = 0;
        this.pending = 0;
        this.fail = 0;
        this.skipped = 0;
        this.seenIdentifiers = new Set();
        this.logId = ctx.logId;
        this.logger = ctx.logger;
        this.registrationService = new registration_service_1.RegistrationService();
    }
    async run(filePath) {
        const records = (0, csv_helpers_1.loadCsvRecords)(filePath);
        const limit = Number(env_1.ENV.CONCURRENCY);
        const activePromises = [];
        for (let i = 0; i < records.length; i++) {
            if (activePromises.length >= limit) {
                await Promise.race(activePromises);
            }
            const p = this.processRow(records[i], i).then(() => { });
            const wrapper = p.finally(() => {
                const idx = activePromises.indexOf(wrapper);
                if (idx !== -1)
                    activePromises.splice(idx, 1);
            });
            activePromises.push(wrapper);
        }
        await Promise.all(activePromises);
        return {
            success: this.success,
            pending: this.pending,
            fail: this.fail,
            skipped: this.skipped,
        };
    }
    buildRequestHeaders(deviceId) {
        return (0, headers_1.buildHeaders)(deviceId, "mobile");
    }
    async processRow(row, index) {
        const deviceId = (0, device_1.generateDeviceId)();
        const rowCheck = (0, csv_helpers_1.validateRow)(row, this.seenIdentifiers);
        if (!rowCheck.valid || !rowCheck.identifier) {
            this.skipped++;
            console.log(`⏭️ SKIP ROW ${index + 1}: ${rowCheck.reason}`);
            return;
        }
        const identifier = rowCheck.identifier;
        const phone = rowCheck.phone;
        this.seenIdentifiers.add(identifier);
        const headers = this.buildRequestHeaders(deviceId);
        const result = await this.registrationService.executeRegistrationFlow(row, index, identifier, phone, deviceId, headers, this.logger);
        if (result.status === "success") {
            this.success++;
        }
        else if (result.status === "pending") {
            this.pending++;
        }
        else if (result.status === "fail") {
            this.fail++;
        }
    }
}
exports.RegisterCsvWorker = RegisterCsvWorker;
//# sourceMappingURL=register-csv.worker.js.map