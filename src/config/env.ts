import path from "path";
import dotenv from "dotenv";

dotenv.config({
  path: path.resolve(process.cwd(), ".env"),
  override: false,
  debug: false,
  quiet: true,
} as any);

function num(v: any, def: number) {
  const n = Number(v);
  return Number.isFinite(n) ? n : def;
}

function str(v: any, def: string) {
  const s = String(v ?? "").trim();
  return s ? s : def;
}

function bool(v: any, def: boolean) {
  if (v === undefined || v === null) return def;
  const s = String(v).trim().toLowerCase();
  if (s === "true" || s === "1" || s === "yes" || s === "y") return true;
  if (s === "false" || s === "0" || s === "no" || s === "n") return false;
  return def;
}

export const ENV = {

  BASE_URL: str(process.env.BASE_URL, "http://localhost:3001"),


  MYSQL_HOST: str(process.env.MYSQL_HOST, "127.0.0.1"),
  MYSQL_PORT: num(process.env.MYSQL_PORT, 3306),
  MYSQL_USER: str(process.env.MYSQL_USER, "root"),
  MYSQL_PASSWORD: str(process.env.MYSQL_PASSWORD, ""),
  MYSQL_DATABASE: str(process.env.MYSQL_DATABASE, "auth_service"),
  MYSQL_CONN_LIMIT: num(process.env.MYSQL_CONN_LIMIT, 10),

  CSV_PATH: str(process.env.CSV_PATH, "users.csv"),
  INTERVAL_MS: num(process.env.INTERVAL_MS, 60_000),
  CONCURRENCY: num(process.env.CONCURRENCY, 5),
  RUN_ONCE: bool(process.env.RUN_ONCE, false),


  OTP_TIMEOUT_MS: num(process.env.OTP_TIMEOUT_MS, 60_000),
  OTP_POLL_MS: num(process.env.OTP_POLL_MS, 500),
  OTP_VERIFY_RETRY: num(process.env.OTP_VERIFY_RETRY, 5),
  OTP_DEBUG_PATH_PENDING: str(process.env.OTP_DEBUG_PATH_PENDING, "/auth/debug/pending-otp"),
  OTP_DEBUG_PATH_REDIS: str(process.env.OTP_DEBUG_PATH_REDIS, "/auth/debug/redis-otp"),


  LOG_RETENTION_DAYS: num(process.env.LOG_RETENTION_DAYS, 7),


  LOG_LEVEL: str(process.env.LOG_LEVEL, "info"),
  LOG_VERBOSE: bool(process.env.LOG_VERBOSE, true),
  LOG_HTTP: bool(process.env.LOG_HTTP, true),
  LOG_OTP_PLAINTEXT: bool(process.env.LOG_OTP_PLAINTEXT, false),
  LOG_PASSWORD_PLAINTEXT: bool(process.env.LOG_PASSWORD_PLAINTEXT, false),
};

