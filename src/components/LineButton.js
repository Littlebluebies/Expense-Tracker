import { useEffect, useState } from "react";
import { MessageCircle } from "lucide-react";
import { startLine } from "../firebase/lineAuth";
import { lineErrorMessage } from "../utils/lineAuth";

// ปุ่มไปหน้า LINE Login (ใช้ทั้งเข้าสู่ระบบ สมัคร เชื่อมบัญชี และยืนยันตัวตนใหม่ก่อนลบบัญชี)
export default function LineButton({ mode = "login", returnTo, onError, children = "เข้าสู่ระบบด้วย LINE" }) {
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
            await startLine({ mode, returnTo });
        } catch {
            setBusy(false);
            onError?.(lineErrorMessage("failed"));
        }
    };

    return (
        <button type="button" className="btn btn-line w-100" onClick={go} disabled={busy}>
            <MessageCircle size={18} aria-hidden="true" />
            {busy ? "กำลังไปที่ LINE..." : children}
        </button>
    );
}
