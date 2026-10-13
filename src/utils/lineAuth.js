// ตัวช่วยฝั่งหน้าเว็บสำหรับ LINE Login (ไม่ import Firebase เพื่อให้เทสต์ได้)

export const LINE_ERRORS = {
    cancelled: "ยกเลิกการเข้าสู่ระบบด้วย LINE",
    expired: "ลิงก์หมดอายุ ลองใหม่อีกครั้ง",
    already_linked: "LINE นี้เชื่อมกับบัญชีอื่นอยู่แล้ว",
    failed: "เข้าสู่ระบบด้วย LINE ไม่สำเร็จ ลองใหม่อีกครั้ง",
};

export const lineErrorMessage = (code) => (code ? LINE_ERRORS[code] || LINE_ERRORS.failed : "");

// ปฏิเสธ control character และ backslash ด้วย: URL parser ตัด tab/newline ทิ้ง ("/\t/evil.com" กลายเป็น "//evil.com")
// eslint-disable-next-line no-control-regex -- ตั้งใจจับ control character ทั้งหมดเพื่อความปลอดภัยของ redirect
const UNSAFE_PATH_CHARS = /[\u0000-\u001f\u007f\\]/;
const safePath = (path) =>
    path && path.startsWith("/") && !path.startsWith("//") && !UNSAFE_PATH_CHARS.test(path) ? path : "/dashboard";

// /auth/line#token=...&returnTo=/settings
export function readLineHash(hash) {
    const params = new URLSearchParams((hash || "").replace(/^#/, ""));
    return { token: params.get("token"), returnTo: safePath(params.get("returnTo")) };
}

// บัญชีที่สมัครด้วยอีเมล (ถึงจะเชื่อม LINE แล้วก็ยังมี provider "password")
export const hasPassword = (user) => Boolean(user?.providerData?.some((p) => p.providerId === "password"));

// Firebase ยอมให้ลบบัญชีถ้า login มาไม่เกิน 5 นาที -> เผื่อไว้ใช้ 4 นาที
// authTime กับ issuedAtTime มาจาก server ทั้งคู่ (ไม่พึ่งนาฬิกาเครื่อง)
// ต้องส่งผลของ getIdTokenResult(true) เพื่อให้ token ออกใหม่ตอนนี้
const RECENT_MS = 4 * 60 * 1000;
export function isRecentSignIn(tokenResult) {
    const issued = Date.parse(tokenResult?.issuedAtTime || "");
    const auth = Date.parse(tokenResult?.authTime || "");
    return Number.isFinite(issued) && Number.isFinite(auth) && issued - auth < RECENT_MS;
}
