import { json, redirect, safeReturnTo } from "./http.mjs";
import { STATE_COOKIE, openCookie, readCookie, sealCookie, stateCookieHeader } from "./cookie.mjs";
import { authorizeUrl, exchangeCode, randomToken, verifyIdToken } from "./lineOAuth.mjs";
import { linkLineAccount, resolveLoginUser } from "./accounts.mjs";

const COOKIE_MAX_AGE = 600; // 10 นาที
const callbackUrl = (request) => `${new URL(request.url).origin}/api/auth/line/callback`;

// POST /api/auth/line/start  { mode: "login" | "link", returnTo? }
export function createStartHandler({ auth, cookieSecret, channelId, random = randomToken }) {
    return async (request) => {
        let body = {};
        try {
            body = (await request.json()) || {};
        } catch {
            body = {};
        }
        const mode = body.mode === "link" ? "link" : "login";
        const returnTo = safeReturnTo(body.returnTo) ?? (mode === "link" ? "/settings" : "/dashboard");

        // เชื่อมบัญชี: ต้องรู้ว่าใครกำลัง login อยู่ -> ตรวจ Firebase ID token
        let uid = null;
        if (mode === "link") {
            const header = request.headers.get("authorization") || "";
            try {
                uid = (await auth.verifyIdToken(header.replace(/^Bearer /, ""))).uid;
            } catch {
                return json({ error: "unauthorized" }, 401);
            }
        }

        const state = random();
        const nonce = random();
        const cookie = sealCookie({ state, nonce, mode, uid, returnTo }, cookieSecret, Date.now(), COOKIE_MAX_AGE);
        const url = authorizeUrl({ channelId, redirectUri: callbackUrl(request), state, nonce });
        return json({ url }, 200, {
            "Set-Cookie": stateCookieHeader(cookie, COOKIE_MAX_AGE),
            "Cache-Control": "no-store",
        });
    };
}

// GET /api/auth/line/callback?code&state  (หรือ ?error=... ถ้าผู้ใช้กดยกเลิก)
export function createCallbackHandler({ auth, db, cookieSecret, channelId, channelSecret, fetchImpl = fetch }) {
    return async (request) => {
        const url = new URL(request.url);
        const saved = openCookie(readCookie(request.headers.get("cookie"), STATE_COOKIE), cookieSecret);
        // ลบ cookie ทุกครั้ง (ใช้ได้ครั้งเดียว)
        const go = (path) => redirect(path, { "Set-Cookie": stateCookieHeader("", 0), "Cache-Control": "no-store" });
        const fail = (code) => go(saved?.mode === "link" ? `/settings?line_error=${code}` : `/?line_error=${code}`);

        if (!saved) return go("/?line_error=expired");
        const error = url.searchParams.get("error");
        if (error) return fail(error.toLowerCase() === "access_denied" ? "cancelled" : "failed");
        if (url.searchParams.get("state") !== saved.state) return fail("expired");
        const code = url.searchParams.get("code");
        if (!code) return fail("failed");

        try {
            const idToken = await exchangeCode({ code, redirectUri: callbackUrl(request), channelId, channelSecret }, fetchImpl);
            const profile = await verifyIdToken({ idToken, channelId, nonce: saved.nonce }, fetchImpl);

            if (saved.mode === "link") {
                const result = await linkLineAccount({ ...profile, uid: saved.uid }, { db });
                return result === "linked" ? go("/settings?line=linked") : fail(result);
            }

            const uid = await resolveLoginUser(profile, { auth, db });
            const token = await auth.createCustomToken(uid);
            // token อยู่หลัง # -> เบราว์เซอร์ไม่ส่งไป server จึงไม่ติดใน log
            const hash = new URLSearchParams({ token, returnTo: saved.returnTo || "/dashboard" });
            return go(`/auth/line#${hash}`);
        } catch (err) {
            console.error("LINE callback failed:", err?.message);
            return fail("failed");
        }
    };
}
