import { useId, useState } from "react";
import { createUserWithEmailAndPassword, sendEmailVerification, updateProfile } from "firebase/auth";
import { OctagonAlert } from "lucide-react";
import { auth } from "../firebase/config";
import { errorMessage } from "../firebase/errors";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import AuthShell from "../components/AuthShell";

export default function Register() {
    const [username, setUsername] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);
    const { refresh } = useAuth();
    const id = useId();

    const handleRegister = async (e) => {
        e.preventDefault();
        setError("");

        if (!username.trim()) {
            setError("กรุณากรอกชื่อผู้ใช้");
            return;
        }
        if (password.length < 6) {
            setError("รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร");
            return;
        }
        if (password !== confirmPassword) {
            setError("รหัสผ่านไม่ตรงกัน");
            return;
        }

        try {
            setLoading(true);
            const { user } = await createUserWithEmailAndPassword(auth, email.trim(), password);
            await updateProfile(user, { displayName: username.trim() });
            // ให้ Dashboard แสดงชื่อทันที (onAuthStateChanged ยิงไปก่อนตั้งชื่อเสร็จ)
            refresh();
            // ส่งอีเมลยืนยัน ไม่ต้องรอ ถ้าส่งไม่สำเร็จ ผู้ใช้กดส่งใหม่ได้ที่หน้าตั้งค่า
            sendEmailVerification(user).catch(console.error);
        } catch (err) {
            setError(errorMessage(err));
        } finally {
            setLoading(false);
        }
    };

    return (
        <AuthShell>
            <form className="auth-form form-stack" onSubmit={handleRegister}>
                <div>
                    <h2>สมัครสมาชิก</h2>
                    <p className="muted mb-0">ใช้ฟรี ไม่มีโฆษณา เข้าใช้ได้ทันทีหลังสมัคร</p>
                </div>

                {error && (
                    <div className="form-error" role="alert">
                        <OctagonAlert size={16} aria-hidden="true" />
                        <span>{error}</span>
                    </div>
                )}

                <div>
                    <label className="form-label" htmlFor={`${id}-name`}>
                        ชื่อผู้ใช้
                    </label>
                    <input
                        id={`${id}-name`}
                        className="form-control"
                        autoComplete="nickname"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        required
                    />
                </div>
                <div>
                    <label className="form-label" htmlFor={`${id}-email`}>
                        อีเมล
                    </label>
                    <input
                        id={`${id}-email`}
                        className="form-control"
                        type="email"
                        autoComplete="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                    />
                </div>
                <div>
                    <label className="form-label" htmlFor={`${id}-password`}>
                        รหัสผ่าน
                    </label>
                    <input
                        id={`${id}-password`}
                        className="form-control"
                        type="password"
                        autoComplete="new-password"
                        aria-describedby={`${id}-password-hint`}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                    />
                    <p className="form-hint" id={`${id}-password-hint`}>
                        อย่างน้อย 6 ตัวอักษร
                    </p>
                </div>
                <div>
                    <label className="form-label" htmlFor={`${id}-confirm`}>
                        ยืนยันรหัสผ่าน
                    </label>
                    <input
                        id={`${id}-confirm`}
                        className="form-control"
                        type="password"
                        autoComplete="new-password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        required
                    />
                </div>

                <button type="submit" className="btn btn-primary w-100" disabled={loading}>
                    {loading ? "กำลังสร้างบัญชี..." : "สมัครสมาชิก"}
                </button>

                <p className="auth-switch">
                    มีบัญชีอยู่แล้ว? <Link to="/">เข้าสู่ระบบ</Link>
                </p>
            </form>
        </AuthShell>
    );
}
