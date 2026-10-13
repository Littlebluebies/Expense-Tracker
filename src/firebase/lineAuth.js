import { auth } from "./config";

// เริ่ม LINE Login: ขอ URL จาก server (server ฝัง state ไว้ใน cookie) แล้วพาไปหน้า LINE
// mode "link" = เชื่อม LINE กับบัญชีที่ login อยู่ -> ส่ง ID token ให้ server รู้ว่าเป็นใคร
export async function startLine({ mode = "login", returnTo } = {}) {
    const headers = { "Content-Type": "application/json" };
    if (mode === "link") headers.Authorization = `Bearer ${await auth.currentUser.getIdToken()}`;
    const res = await fetch("/api/auth/line/start", {
        method: "POST",
        headers,
        body: JSON.stringify({ mode, returnTo }),
    });
    if (!res.ok) throw new Error(`line-start-${res.status}`);
    const { url } = await res.json();
    window.location.assign(url);
}
