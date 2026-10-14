import { useEffect, useState } from "react";
import { MessageCircle } from "lucide-react";
import { startLine } from "../firebase/lineAuth";
import { errorMessage } from "../firebase/errors";
import { lineErrorMessage } from "../utils/lineAuth";

// ปุ่มไปหน้า LINE Login (ใช้ทั้งเข้าสู่ระบบ สมัคร เชื่อมบัญชี และยืนยันตัวตนใหม่ก่อนลบบัญชี)
// prepare = งานที่ต้องทำก่อนไปหน้า LINE (เช่น ยืนยันรหัสผ่านอีกครั้งก่อนเชื่อมบัญชี)
export default function LineButton({
    mode = "login",
    returnTo,
    onError,
    prepare,
    disabled = false,
    children = "เข้าสู่ระบบด้วย LINE",
}) {
    const [busy, setBusy] = useState(false);

    // กด back กลับมาจากหน้า LINE -> เบราว์เซอร์คืนหน้าจากแคช (ปุ่มยังค้างสถานะ busy)
    useEffect(() => {
        const onShow = (e) => e.persisted && setBusy(false);
        window.addEventListener("pageshow", onShow);
        return () => window.removeEventListener("pageshow", onShow);
    }, []);

    const go = async () => {
        setBusy(true);
        try {
            if (prepare) await prepare();
            await startLine({ mode, returnTo });
        } catch (err) {
            setBusy(false);
            // ข้อผิดพลาดจาก Firebase Auth (เช่น รหัสผ่านผิด) บอกตรงๆ ที่เหลือใช้ข้อความกลาง
            const authError = typeof err?.code === "string" && err.code.startsWith("auth/");
            onError?.(authError ? errorMessage(err) : lineErrorMessage("failed"));
        }
    };

    return (
        <button type="button" className="btn btn-line w-100" onClick={go} disabled={busy || disabled}>
            <MessageCircle size={18} aria-hidden="true" />
            {busy ? "กำลังไปที่ LINE..." : children}
        </button>
    );
}
