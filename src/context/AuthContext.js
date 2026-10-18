import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { auth } from "../firebase/config";

// Firebase จำการ login ไว้ตลอดจนกว่าจะกดออกเอง -> บังคับหมดอายุเอง
const IDLE_TIMEOUT = 30 * 60 * 1000; // ไม่ได้ใช้งานเกิน 30 นาที
const MAX_SESSION = 7 * 24 * 60 * 60 * 1000; // login ครั้งล่าสุดนานเกิน 7 วัน
const SESSION_KEY = "session"; // { signIn, start, active }
const ACTIVITY_EVENTS = ["pointerdown", "keydown", "scroll", "touchstart"];

const readSession = () => {
    try {
        return JSON.parse(localStorage.getItem(SESSION_KEY)) || {};
    } catch {
        return {};
    }
};

// นับเวลาด้วยนาฬิกาเครื่องทั้งหมด (ไม่เทียบกับเวลาเซิร์ฟเวอร์ กันนาฬิกาเครื่องเพี้ยนแล้วโดนเตะวนลูป)
// lastSignInTime เปลี่ยน = เพิ่ง login ใหม่ -> เริ่มนับใหม่
const touchSession = (user, now = Date.now()) => {
    const s = readSession();
    const signIn = user.metadata.lastSignInTime;
    const next = s.signIn === signIn ? { ...s, active: now } : { signIn, start: now, active: now };
    try {
        localStorage.setItem(SESSION_KEY, JSON.stringify(next));
    } catch {
        // localStorage ใช้ไม่ได้ (private mode ฯลฯ) -> ไม่บังคับหมดอายุ
    }
};

const isExpired = (user, now = Date.now()) => {
    const s = readSession();
    if (s.signIn !== user.metadata.lastSignInTime) return false;
    return now - s.start > MAX_SESSION || now - s.active > IDLE_TIMEOUT;
};

const AuthContext = createContext({ user: null, loading: true, expired: false, refresh: () => {} });

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [expired, setExpired] = useState(false);
    const [, setVersion] = useState(0);

    useEffect(
        () =>
            onAuthStateChanged(auth, (u) => {
                if (u && isExpired(u)) {
                    // ยังไม่ปล่อยให้เห็นหน้า dashboard รอ callback รอบ null จาก signOut
                    setExpired(true);
                    signOut(auth);
                    return;
                }
                if (u) {
                    setExpired(false);
                    touchSession(u);
                }
                setUser(u);
                setLoading(false);
            }),
        []
    );

    // จดเวลาใช้งานล่าสุด + เช็คหมดอายุเป็นระยะ (ใช้ร่วมกันทุกแท็บผ่าน localStorage)
    useEffect(() => {
        if (!user) return undefined;

        const check = () => {
            if (isExpired(user)) {
                setExpired(true);
                signOut(auth);
                return true;
            }
            return false;
        };

        let last = 0;
        const onActivity = () => {
            const now = Date.now();
            if (now - last < 15000) return; // ไม่ต้องเขียนทุก event
            if (check()) return; // กลับมาหลังทิ้งไว้นาน -> ไม่ต่ออายุให้
            last = now;
            touchSession(user, now);
        };
        const onVisible = () => document.visibilityState === "visible" && check();

        ACTIVITY_EVENTS.forEach((e) => window.addEventListener(e, onActivity, { passive: true }));
        document.addEventListener("visibilitychange", onVisible);
        const timer = setInterval(check, 60000);

        return () => {
            ACTIVITY_EVENTS.forEach((e) => window.removeEventListener(e, onActivity));
            document.removeEventListener("visibilitychange", onVisible);
            clearInterval(timer);
        };
    }, [user]);

    // updateProfile / user.reload() แก้ object เดิม ไม่ได้แจ้ง onAuthStateChanged
    // signInWithCustomToken ด้วย uid เดิม (login LINE ซ้ำ) ได้ object ใหม่ แต่ก็ไม่แจ้งเพราะ uid ไม่เปลี่ยน
    // เรียก refresh() เพื่อให้ใช้ผู้ใช้ล่าสุด และหน้าจอแสดงชื่อ/สถานะยืนยันอีเมลล่าสุด
    const refresh = useCallback(async () => {
        const u = auth.currentUser;
        if (u) {
            await u.reload().catch(() => {});
            touchSession(u);
        }
        setUser(u);
        setVersion((v) => v + 1);
    }, []);

    return (
        <AuthContext.Provider value={{ user, loading, expired, refresh }}>
            {children}
        </AuthContext.Provider>
    );
}

export const useAuth = () => useContext(AuthContext);
