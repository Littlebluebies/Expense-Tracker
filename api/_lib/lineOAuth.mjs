import { randomBytes } from "node:crypto";

// LINE Login v2.1: https://developers.line.biz/en/reference/line-login/
const AUTHORIZE_URL = "https://access.line.me/oauth2/v2.1/authorize";
const TOKEN_URL = "https://api.line.me/oauth2/v2.1/token";
const VERIFY_URL = "https://api.line.me/oauth2/v2.1/verify";
const FORM = { "Content-Type": "application/x-www-form-urlencoded" };

export const randomToken = () => randomBytes(32).toString("base64url");

// bot_prompt=aggressive: login เสร็จแล้ว LINE จะเปิดหน้าเพิ่มเพื่อนบอทให้
export function authorizeUrl({ channelId, redirectUri, state, nonce }) {
    const params = new URLSearchParams({
        response_type: "code",
        client_id: channelId,
        redirect_uri: redirectUri,
        state,
        scope: "openid profile",
        nonce,
        bot_prompt: "aggressive",
    });
    return `${AUTHORIZE_URL}?${params}`;
}

export async function exchangeCode({ code, redirectUri, channelId, channelSecret }, fetchImpl = fetch) {
    const res = await fetchImpl(TOKEN_URL, {
        method: "POST",
        headers: FORM,
        body: new URLSearchParams({
            grant_type: "authorization_code",
            code,
            redirect_uri: redirectUri,
            client_id: channelId,
            client_secret: channelSecret,
        }),
    });
    if (!res.ok) throw new Error(`LINE token exchange failed (${res.status})`);
    const data = await res.json();
    if (!data.id_token) throw new Error("LINE token response has no id_token");
    return data.id_token;
}

// ให้ LINE ตรวจลายเซ็น/อายุ/aud/nonce ของ ID token ให้ (endpoint verify)
export async function verifyIdToken({ idToken, channelId, nonce }, fetchImpl = fetch) {
    const res = await fetchImpl(VERIFY_URL, {
        method: "POST",
        headers: FORM,
        body: new URLSearchParams({ id_token: idToken, client_id: channelId, nonce }),
    });
    if (!res.ok) throw new Error(`LINE ID token verify failed (${res.status})`);
    const payload = await res.json();
    if (!payload.sub) throw new Error("LINE ID token has no sub");
    return { lineUserId: payload.sub, name: payload.name || "" };
}
