import { json, redirect, safeReturnTo } from "./http.mjs";
import { STATE_COOKIE, openCookie, readCookie, sealCookie, stateCookieHeader } from "./cookie.mjs";
import { authorizeUrl, exchangeCode, randomToken, verifyIdToken } from "./lineOAuth.mjs";
import { linkLineAccount, resolveLoginUser } from "./accounts.mjs";

const COOKIE_MAX_AGE = 600; // 10 นาที
const LINK_MAX_AUTH_AGE = 300; // เชื่อม LINE ได้ถ้า login มาไม่เกิน 5 นาที (วินาที)
const BROWSER_NONCE = /^[A-Za-z0-9_-]{16,64}$/;
const callbackUrl = (request) => `${new URL(request.url).origin}/api/auth/line/callback`;

// POST /api/auth/line/start  { mode: "login" | "link", returnTo?, cn? }
// cn = ค่าสุ่มที่หน้าเว็บเก็บไว้ใน localStorage (บังคับตอน login) ส่งกลับไปใน #hash ให้หน้าเว็บเทียบ
// กันคนอื่นส่งลิงก์ /auth/line#token=... ของบัญชีเขามาให้เรา login (login CSRF)
export function createStartHandler({ auth, cookieSecret, channelId, random = randomToken, now = Date.now }) {
    return async (request) => {
        let body = {};
        try {
            body = (await request.json()) || {};
        } catch {
            body = {};
        }
        const mode = body.mode === "link" ? "link" : "login";
        const returnTo = safeReturnTo(body.returnTo) ?? (mode === "link" ? "/settings" : "/dashboard");
        let cn = null;
        if (mode === "login") {
            if (typeof body.cn !== "string" || !BROWSER_NONCE.test(body.cn)) return json({ error: "bad_request" }, 400);
            cn = body.cn;
        }

        // เชื่อมบัญชี: ต้องรู้ว่าใครกำลัง login อยู่ -> ตรวจ Firebase ID token (รวมถึงถูกเพิกถอนหรือยัง)
        // และต้อง login มาไม่นาน กัน ID token ที่หลุดไปถูกใช้ผูก LINE ของคนอื่นเข้ากับบัญชี
        let uid = null;
        if (mode === "link") {
            const header = request.headers.get("authorization") || "";
            let decoded;
            try {
                decoded = await auth.verifyIdToken(header.replace(/^Bearer /, ""), true);
            } catch {
                return json({ error: "unauthorized" }, 401);
            }
            if (!decoded.auth_time || now() / 1000 - decoded.auth_time > LINK_MAX_AUTH_AGE) {
                return json({ error: "reauth_required" }, 401);
            }
            uid = decoded.uid;
        }

        const state = random();
        const nonce = random();
        const cookie = sealCookie({ state, nonce, mode, uid, returnTo, cn }, cookieSecret, Date.now(), COOKIE_MAX_AGE);
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
            const hash = new URLSearchParams({ token, returnTo: saved.returnTo || "/dashboard", cn: saved.cn || "" });
            return go(`/auth/line#${hash}`);
        } catch (err) {
            console.error("LINE callback failed:", err?.message);
            return fail("failed");
        }
    };
}
