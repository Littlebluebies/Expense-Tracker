import { createHmac, timingSafeEqual } from "node:crypto";

// ตรวจว่า request มาจาก LINE จริง: x-line-signature = base64(HMAC-SHA256(channel secret, raw body))
export function verifySignature(rawBody, signature, secret) {
    if (!signature || !secret) return false;
    const expected = createHmac("sha256", secret).update(rawBody).digest();
    const given = Buffer.from(signature, "base64");
    return given.length === expected.length && timingSafeEqual(given, expected);
}

// reply message ไม่นับโควตาข้อความของ LINE (push นับ) -> ใช้แค่ reply
export async function replyMessage(replyToken, messages, accessToken, fetchImpl = fetch) {
    if (!messages.length) return;
    const res = await fetchImpl("https://api.line.me/v2/bot/message/reply", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ replyToken, messages }),
    });
    if (!res.ok) throw new Error(`LINE reply failed (${res.status}): ${await res.text()}`);
}
