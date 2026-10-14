import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { signInWithCustomToken } from "firebase/auth";
import { auth } from "../firebase/config";
import { useAuth } from "../context/AuthContext";
import { readLineHash, takeLoginNonce } from "../utils/lineAuth";
import { RosetteMark } from "../components/Guilloche";

// localStorage อาจโยน error ตั้งแต่ตอนเข้าถึง (เบราว์เซอร์บล็อกข้อมูลเว็บไซต์)
const localStorageOrNull = () => {
    try {
        return window.localStorage;
    } catch {
        return null;
    }
};

// /auth/line#token=...&returnTo=...&cn=...  (server ส่งมาหลัง LINE Login สำเร็จ)
export default function LineCallback() {
    const navigate = useNavigate();
    const { user } = useAuth();
    const started = useRef(false); // StrictMode เรียก effect สองรอบ -> sign in ครั้งเดียว
    const [target, setTarget] = useState(null);

    useEffect(() => {
        if (started.current) return;
        started.current = true;
        const { token, returnTo, cn } = readLineHash(window.location.hash);
        // ล้าง token ออกจากแถบ URL/ประวัติทันที
        window.history.replaceState(null, "", window.location.pathname);
        // ยังมีคน login อยู่ (เช่น ยืนยันตัวตนใหม่ก่อนลบบัญชี) -> กลับไปหน้าตั้งค่า
        const fail = () =>
            navigate(auth.currentUser ? "/settings?line_error=failed" : "/?line_error=failed", { replace: true });
        // token ต้องมาจากการกดปุ่ม LINE ในเบราว์เซอร์นี้เท่านั้น (กันลิงก์ที่คนอื่นส่งมา)
        const fromThisBrowser = takeLoginNonce(localStorageOrNull(), cn);
        if (!token || !fromThisBrowser) {
            fail();
            return;
        }
        signInWithCustomToken(auth, token)
            .then(() => setTarget(returnTo))
            .catch(fail);
    }, [navigate]);

    // รอให้ AuthContext เห็นผู้ใช้ก่อน ไม่งั้น PrivateRoute จะเด้งกลับหน้า login
    useEffect(() => {
        if (target && user) navigate(target, { replace: true });
    }, [target, user, navigate]);

    return (
        <div className="app-loading" role="status" aria-label="กำลังเข้าสู่ระบบด้วย LINE">
            <RosetteMark size={36} />
            <span className="bar" />
        </div>
    );
}
