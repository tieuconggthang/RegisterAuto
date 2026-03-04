"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.loadCsvRecords = loadCsvRecords;
exports.pickGender = pickGender;
exports.validateRow = validateRow;
exports.buildPayload = buildPayload;
const fs_1 = __importDefault(require("fs"));
const sync_1 = require("csv-parse/sync");
const phone_1 = require("./phone");
function loadCsvRecords(filePath) {
    if (!fs_1.default.existsSync(filePath)) {
        throw new Error("CSV_NOT_FOUND");
    }
    let contentBuf;
    try {
        contentBuf = fs_1.default.readFileSync(filePath);
    }
    catch {
        throw new Error("CSV_READ_FAIL");
    }
    let records = [];
    try {
        records = (0, sync_1.parse)(contentBuf, {
            columns: true,
            skip_empty_lines: true,
            trim: true,
        });
    }
    catch {
        throw new Error("CSV_PARSE_FAIL");
    }
    if (!Array.isArray(records) || records.length === 0) {
        throw new Error("CSV_EMPTY");
    }
    return records;
}
function pickGender(g) {
    const x = String(g || "").trim().toUpperCase();
    if (x === "MALE" || x === "FEMALE" || x === "OTHER")
        return x;
    return "OTHER";
}
function validateRow(row, seenIdentifiers) {
    const rawUsername = String(row.username || "").trim();
    const rawPhone = String(row.phone || "").trim();
    const password = String(row.password || "").trim();
    if (!password) {
        return { valid: false, reason: "missing_password" };
    }
    let normalizedPhone;
    if (rawPhone) {
        const norm = (0, phone_1.normalizeVietnamPhone)(rawPhone);
        if (!norm.ok) {
            return { valid: false, reason: `invalid_phone_format:${norm.reason}` };
        }
        normalizedPhone = norm.local;
    }
    const username = rawUsername || undefined;
    const identifier = username || normalizedPhone;
    if (!identifier) {
        return { valid: false, reason: "missing_username_and_phone" };
    }
    if (seenIdentifiers.has(identifier)) {
        return { valid: false, reason: "duplicate_identifier_in_csv" };
    }
    return {
        valid: true,
        phone: normalizedPhone,
        username,
        identifier,
    };
}
function buildPayload(row, identifier) {
    return {
        username: identifier,
        password: row.password?.trim(),
        confirmedPassword: row.password?.trim(),
        firstName: row.firstName?.trim() || "Auto",
        lastName: row.lastName?.trim() || "User",
        gender: pickGender(row.gender),
        dateOfBirth: row.dateOfBirth || "2000-01-01",
        location: { lat: 10.762622, lon: 106.660172, source: "GPS" },
    };
}
//# sourceMappingURL=csv-helpers.js.map