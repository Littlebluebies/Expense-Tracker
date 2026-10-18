import { useId, useState } from "react";
import { signInWithEmailAndPassword, sendPasswordResetEmail } from "firebase/auth";
import { CircleCheck, Clock, OctagonAlert } from "lucide-react";
import { auth } from "../firebase/config";
import { errorMessage } from "../firebase/errors";
import { Link, useSearchParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import AuthShell from "../components/AuthShell";
import Sheet from "../components/Sheet";
import LineButton from "../components/LineButton";
import { lineErrorMessage } from "../utils/lineAuth";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { expired } = useAuth();
  const id = useId();
  const [searchParams] = useSearchParams();
  // กลับจากหน้า LINE แบบไม่สำเร็จ -> callback แนบ ?line_error=... มา
  const lineError = lineErrorMessage(searchParams.get("line_error"));

  const [showReset, setShowReset] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [resetMsg, setResetMsg] = useState(null); // { ok, text }

  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");
    try {
      setLoading(true);
      await signInWithEmailAndPassword(auth, email.trim(), password);
      // PublicRoute จะพาไป /dashboard เอง
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    setResetMsg(null);
    try {
      setLoading(true);
      await sendPasswordResetEmail(auth, resetEmail.trim());
      setResetMsg({ ok: true, text: "ส่งลิงก์รีเซ็ตรหัสผ่านไปที่อีเมลแล้ว" });
    } catch (err) {
      setResetMsg({ ok: false, text: errorMessage(err) });
    } finally {
      setLoading(false);
    }
  };

  const openReset = () => {
    setResetEmail(email);
    setResetMsg(null);
    setShowReset(true);
  };

  return (
    <AuthShell>
      <form className="auth-form form-stack" onSubmit={handleLogin}>
        <div>
          <h2>เข้าสู่ระบบ</h2>
          <p className="muted mb-0">บันทึกรายรับ-รายจ่ายของคุณ</p>
        </div>

        {error && (
          <div className="form-error" role="alert">
            <OctagonAlert size={16} aria-hidden="true" />
            <span>{error}</span>
          </div>
        )}
        {!error && expired && (
          <div className="form-error is-warn" role="status">
            <Clock size={16} aria-hidden="true" />
            <span>เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่อีกครั้ง</span>
          </div>
        )}
        {!error && !expired && lineError && (
          <div className="form-error" role="alert">
            <OctagonAlert size={16} aria-hidden="true" />
            <span>{lineError}</span>
          </div>
        )}

        <LineButton onError={setError} />
        <p className="muted small mb-0">
          มีบัญชีอีเมลอยู่แล้ว? เข้าสู่ระบบด้วยอีเมลก่อน แล้วเชื่อม LINE ที่หน้าตั้งค่า
        </p>
        <div className="auth-divider">หรือใช้อีเมล</div>

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
          <div className="d-flex justify-content-between align-items-baseline">
            <label className="form-label" htmlFor={`${id}-password`}>
              รหัสผ่าน
            </label>
            <button type="button" className="btn btn-link small" onClick={openReset}>
              ลืมรหัสผ่าน?
            </button>
          </div>
          <input
            id={`${id}-password`}
            className="form-control"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>

        <button type="submit" className="btn btn-primary w-100" disabled={loading}>
          {loading ? "กำลังเข้าสู่ระบบ..." : "เข้าสู่ระบบ"}
        </button>

        <p className="auth-switch">
          ยังไม่มีบัญชี? <Link to="/register">สมัครสมาชิก</Link>
        </p>
      </form>

      <Sheet open={showReset} onClose={() => setShowReset(false)} title="รีเซ็ตรหัสผ่าน" center>
        <form className="form-stack" onSubmit={handleResetPassword}>
          <p className="muted mb-0">ใส่อีเมลที่ใช้สมัคร ระบบจะส่งลิงก์ตั้งรหัสผ่านใหม่ไปให้</p>

          {resetMsg && (
            <div className={`form-error ${resetMsg.ok ? "is-ok" : ""}`} role="status">
              {resetMsg.ok ? (
                <CircleCheck size={16} aria-hidden="true" />
              ) : (
                <OctagonAlert size={16} aria-hidden="true" />
              )}
              <span>{resetMsg.text}</span>
            </div>
          )}

          <div>
            <label className="form-label" htmlFor={`${id}-reset`}>
              อีเมลที่ใช้สมัคร
            </label>
            <input
              id={`${id}-reset`}
              className="form-control"
              type="email"
              autoComplete="email"
              value={resetEmail}
              onChange={(e) => setResetEmail(e.target.value)}
              required
              data-autofocus
            />
          </div>

          <div className="form-actions">
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? "กำลังส่ง..." : "ส่งลิงก์รีเซ็ต"}
            </button>
            <button type="button" className="btn btn-ghost" onClick={() => setShowReset(false)}>
              ปิด
            </button>
          </div>
        </form>
      </Sheet>
    </AuthShell>
  );
}
