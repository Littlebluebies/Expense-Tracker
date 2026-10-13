import { createHmac, timingSafeEqual } from "node:crypto";

// cookie ที่ลงลายเซ็น HMAC เก็บ state/nonce ระหว่างไปหน้า LINE แล้วกลับมา
// เนื้อหาอ่านได้ (base64url) แต่แก้ไม่ได้ และมีเวลาหมดอายุในตัว
export const STATE_COOKIE = "line_oauth";

const sign = (body, secret) => createHmac("sha256", secret).update(body).digest("base64url");

export function sealCookie(payload, secret, now = Date.now(), maxAgeSec = 600) {
    const body = Buffer.from(JSON.stringify({ ...payload, exp: now + maxAgeSec * 1000 })).toString("base64url");
    return `${body}.${sign(body, secret)}`;
}

export function openCookie(value, secret, now = Date.now()) {
    if (typeof value !== "string") return null;
    const [body, sig, extra] = value.split(".");
    if (!body || !sig || extra !== undefined) return null;
    const expected = Buffer.from(sign(body, secret));
    const given = Buffer.from(sig);
    if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
    try {
        const data = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
        return typeof data.exp === "number" && data.exp >= now ? data : null;
    } catch {
        return null;
    }
}

export function readCookie(header, name) {
    for (const part of (header || "").split(";")) {
        const [key, ...rest] = part.trim().split("=");
        if (key === name) return rest.join("=");
    }
    return null;
}

export const stateCookieHeader = (value, maxAgeSec) =>
    `${STATE_COOKIE}=${value}; Path=/api/auth/line; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAgeSec}`;
