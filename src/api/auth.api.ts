import axios from "axios";
import { ENV } from "../config/env";
import { applySignatureInterceptor } from "../utils/axiosSignature";
import { normalizePhone } from "../utils/phone";

export function parseApiRes(body: any): ApiRes | null {
  if (!body || typeof body !== "object") return null;
  if (typeof (body as any).isSucceed === "boolean") return body as ApiRes;
  return null;
}

export type ApiRes<T = any> = {
  isSucceed: boolean;
  message?: string;
  data?: T;
};

export type RegisterPayload = {
  firstName: string;
  lastName: string;
  username: string;
  dateOfBirth: string;
  password: string;
  confirmedPassword: string;
  gender: "MALE" | "FEMALE" | "OTHER";
  location?: { lat: number; lon: number; source: string };
};

export type RegisterVerifyPayload = {
  phone?: string;
  username?: string;
  otp: string;
};

export type RegisterResendPayload = {
  phone?: string;
  username?: string;
};

const authHttp = axios.create({
  baseURL: ENV.KONG_URL,
  timeout: 20_000,
  headers: {
    "Content-Type": "application/json",
    "Accept": "application/json",
    "X-Client-Type": "mobile",
    "User-Agent": ENV.USER_AGENT,
    "X-Forwarded-Proto": "https",
  },
  validateStatus: () => true,
});

applySignatureInterceptor(authHttp);



export async function validateUsername(username: string, headers?: any) {
  return authHttp.post<ApiRes<any>>("/api/auth/validate-username", { username }, { headers });
}

export async function registerUser(payload: RegisterPayload, headers?: any) {
  const body: RegisterPayload = {
    ...payload,
    username: normalizePhone(payload.username),
  };

  return authHttp.post<ApiRes<any>>("/api/auth/register", body, { headers });
}

export async function verifyRegisterOtpWithPayload(payload: RegisterVerifyPayload, headers?: any) {
  const body: RegisterVerifyPayload = {
    phone: payload.phone ? normalizePhone(payload.phone) : undefined,
    username: payload.username ? String(payload.username).trim() : undefined,
    otp: String(payload.otp || "").trim(),
  };

  return authHttp.post<ApiRes<any>>("/api/auth/verify-register-otp", body, { headers });
}

export async function verifyRegisterOtpApi(phone: string, otp: string, headers?: any) {
  return verifyRegisterOtpWithPayload({ phone, otp }, headers);
}

export async function resendRegisterOtpWithPayload(payload: RegisterResendPayload, headers?: any) {
  const body: RegisterResendPayload = {
    phone: payload.phone ? normalizePhone(payload.phone) : undefined,
    username: payload.username ? String(payload.username).trim() : undefined,
  };

  return authHttp.post<ApiRes<any>>("/api/auth/resend-otp-register", body, { headers });
}

export async function resendRegisterOtpApi(phone: string, headers?: any) {
  return resendRegisterOtpWithPayload({ phone }, headers);
}

