import fs from "fs";
import { parse } from "csv-parse/sync";
import { type ApiRes, type RegisterPayload } from "../api/auth.api";
import { normalizeVietnamPhone } from "./phone";

export type CsvRow = {
  username?: string;
  phone?: string;
  password: string;
  firstName?: string;
  lastName?: string;
  gender?: string;
  dateOfBirth?: string;
};

export function loadCsvRecords(filePath: string): CsvRow[] {
  if (!fs.existsSync(filePath)) {
    throw new Error("CSV_NOT_FOUND");
  }

  let contentBuf: Buffer;
  try {
    contentBuf = fs.readFileSync(filePath);
  } catch {
    throw new Error("CSV_READ_FAIL");
  }

  let records: CsvRow[] = [];
  try {
    records = parse(contentBuf, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
    }) as CsvRow[];
  } catch {
    throw new Error("CSV_PARSE_FAIL");
  }

  if (!Array.isArray(records) || records.length === 0) {
    throw new Error("CSV_EMPTY");
  }

  return records;
}



export function pickGender(g?: string): RegisterPayload["gender"] {
  const x = String(g || "").trim().toUpperCase();
  if (x === "MALE" || x === "FEMALE" || x === "OTHER") return x;
  return "OTHER";
}



export function validateRow(
  row: CsvRow,
  seenIdentifiers: Set<string>
): {
  valid: boolean;
  phone?: string;
  username?: string;
  identifier?: string;
  reason?: string;
} {
  const rawUsername = String(row.username || "").trim();
  const rawPhone = String(row.phone || "").trim();
  const password = String(row.password || "").trim();

  if (!password) {
    return { valid: false, reason: "missing_password" };
  }

  let normalizedPhone: string | undefined;
  if (rawPhone) {
    const norm = normalizeVietnamPhone(rawPhone);
    if (!norm.ok) {
      return { valid: false, reason: `invalid_phone_format:${norm.reason}` };
    }
    normalizedPhone = norm.local!;
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

export function buildPayload(row: CsvRow, identifier: string): RegisterPayload {
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