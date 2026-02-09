"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.loadCsvRecords = loadCsvRecords;
exports.parseApiRes = parseApiRes;
exports.pickGender = pickGender;
exports.normalizeVietnamPhone = normalizeVietnamPhone;
exports.validateRow = validateRow;
exports.buildPayload = buildPayload;
const fs_1 = __importDefault(require("fs"));
const sync_1 = require("csv-parse/sync");
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
function parseApiRes(body) {
    if (!body || typeof body !== "object")
        return null;
    if (typeof body.isSucceed === "boolean")
        return body;
    return null;
}
function pickGender(g) {
    const x = String(g || "").trim().toUpperCase();
    if (x === "MALE" || x === "FEMALE" || x === "OTHER")
        return x;
    return "MALE";
}
function normalizeVietnamPhone(input) {
    const raw = String(input || "").trim();
    if (!raw)
        return { ok: false, reason: "empty" };
    let d = raw.replace(/\D/g, "");
    if (d.startsWith("0084"))
        d = d.slice(2);
    let local = "";
    if (d.startsWith("84")) {
        const rest = d.slice(2);
        local = "0" + rest;
    }
    else if (d.startsWith("0")) {
        local = d;
    }
    else {
        return { ok: false, reason: "must_start_with_0_or_84" };
    }
    if (local.length !== 10)
        return { ok: false, reason: "invalid_length" };
    if (!/^(03|05|07|08|09)\d{8}$/.test(local)) {
        return { ok: false, reason: "invalid_vn_mobile_prefix" };
    }
    const e164 = "+84" + local.slice(1);
    return { ok: true, local, e164 };
}
function validateRow(row, seenPhones) {
    const phoneRaw = String(row.phone || "").trim();
    const password = String(row.password || "").trim();
    const norm = normalizeVietnamPhone(phoneRaw);
    if (!norm.ok) {
        return { valid: false, reason: `invalid_phone_format:${norm.reason}` };
    }
    const phone = norm.local;
    if (!phone || !password) {
        return { valid: false, reason: "missing_phone_or_password" };
    }
    if (seenPhones.has(phone)) {
        return { valid: false, reason: "duplicate_in_csv" };
    }
    return { valid: true, phone };
}
function buildPayload(row, phone) {
    return {
        phone,
        password: row.password?.trim(),
        confirmedPassword: row.password?.trim(),
        firstName: row.firstName?.trim() || "Auto",
        lastName: row.lastName?.trim() || "User",
        gender: pickGender(row.gender),
        dateOfBirth: row.dateOfBirth || "2000-01-01",
        location: { lat: 10.7, lon: 106.6, source: "CSV" },
    };
}
//# sourceMappingURL=csv-helpers.js.map