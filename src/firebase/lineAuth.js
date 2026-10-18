import { auth } from "./config";
import { LOGIN_NONCE_KEY, LOGIN_NONCE_TTL } from "../utils/lineAuth";

// เริ่ม LINE Login: ขอ URL จาก server (server ฝัง state ไว้ใน cookie) แล้วพาไปหน้า LINE
// mode "link" = เชื่อม LINE กับบัญชีที่ login อยู่ -> ส่ง ID token ให้ server รู้ว่าเป็นใคร
// (ขอ token ใหม่เสมอ server ต้องเห็นเวลา login ล่าสุดหลังยืนยันรหัสผ่าน)
// mode "login" = สุ่ม cn เก็บไว้ในเบราว์เซอร์นี้ server จะส่งกลับมาใน #hash ให้เทียบก่อน sign in
export async function startLine({ mode = "login", returnTo } = {}) {
    const headers = { "Content-Type": "application/json" };
    const body = { mode, returnTo };
    if (mode === "link") {
        headers.Authorization = `Bearer ${await auth.currentUser.getIdToken(true)}`;
    } else {
        body.cn = window.crypto.randomUUID();
        try {
            localStorage.setItem(LOGIN_NONCE_KEY, JSON.stringify({ cn: body.cn, exp: Date.now() + LOGIN_NONCE_TTL }));
        } catch {
            // localStorage ใช้ไม่ได้ -> หน้า /auth/line จะไม่ยอม sign in และแจ้งว่าไม่สำเร็จ
        }
    }
    const res = await fetch("/api/auth/line/start", {
        method: "POST",
        headers,
        body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`line-start-${res.status}`);
    const { url } = await res.json();
    window.location.assign(url);
}
