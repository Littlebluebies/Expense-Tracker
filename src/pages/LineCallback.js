import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { signInWithCustomToken } from "firebase/auth";
import { auth } from "../firebase/config";
import { useAuth } from "../context/AuthContext";
import { readLineHash } from "../utils/lineAuth";
import { RosetteMark } from "../components/Guilloche";

// /auth/line#token=...&returnTo=...  (server ส่งมาหลัง LINE Login สำเร็จ)
export default function LineCallback() {
    const navigate = useNavigate();
    const { user } = useAuth();
    const started = useRef(false); // StrictMode เรียก effect สองรอบ -> sign in ครั้งเดียว
    const [target, setTarget] = useState(null);

    useEffect(() => {
        if (started.current) return;
        started.current = true;
        const { token, returnTo } = readLineHash(window.location.hash);
        // ล้าง token ออกจากแถบ URL/ประวัติทันที
        window.history.replaceState(null, "", window.location.pathname);
        if (!token) {
            navigate("/?line_error=failed", { replace: true });
            return;
        }
        signInWithCustomToken(auth, token)
            .then(() => setTarget(returnTo))
            .catch(() => navigate("/?line_error=failed", { replace: true }));
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
