export function normalizePhone(raw: string): string {
    return String(raw || "").trim().replace(/\D/g, "");
}

type PhoneNorm = { ok: boolean; local?: string; e164?: string; reason?: string };

export function normalizeVietnamPhone(input: string): PhoneNorm {
    const raw = String(input || "").trim();
    if (!raw) return { ok: false, reason: "empty" };

    let d = raw.replace(/\D/g, "");
    if (d.startsWith("0084")) d = d.slice(2);

    let local = "";
    if (d.startsWith("84")) {
        const rest = d.slice(2);
        local = "0" + rest;
    } else if (d.startsWith("0")) {
        local = d;
    } else {
        return { ok: false, reason: "must_start_with_0_or_84" };
    }

    if (local.length !== 10) return { ok: false, reason: "invalid_length" };
    if (!/^(03|05|07|08|09)\d{8}$/.test(local)) {
        return { ok: false, reason: "invalid_vn_mobile_prefix" };
    }

    const e164 = "+84" + local.slice(1);
    return { ok: true, local, e164 };
}
