import { useEffect, useId, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
    EmailAuthProvider,
    deleteUser,
    reauthenticateWithCredential,
    sendEmailVerification,
    signOut,
    updatePassword,
    updateProfile,
} from "firebase/auth";
import { collection, doc, getDocs, query, where, writeBatch } from "firebase/firestore";
import { ArrowLeft, CircleCheck, Clock, Download, LogOut, TriangleAlert } from "lucide-react";
import { auth, db } from "../firebase/config";
import { errorMessage } from "../firebase/errors";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { useTransactions } from "../utils/useFinanceData";
import { exportCsv } from "../utils/csv";
import { toInputDate } from "../utils/format";
import { hasPassword, isRecentSignIn, lineErrorMessage } from "../utils/lineAuth";
import LineButton from "../components/LineButton";
import LineSection from "../components/LineSection";
import Guilloche from "../components/Guilloche";

// ยืนยันตัวตนด้วยรหัสผ่านอีกครั้ง (Firebase บังคับก่อนเปลี่ยนรหัส/ลบบัญชี)
const reauth = (user, password) =>
    reauthenticateWithCredential(user, EmailAuthProvider.credential(user.email, password));

// ลบเอกสารทั้งหมดของผู้ใช้ใน collection (ทีละไม่เกิน 450 ต่อ batch)
async function deleteAllOwned(name, uid) {
    const snap = await getDocs(query(collection(db, name), where("userId", "==", uid)));
    for (let i = 0; i < snap.docs.length; i += 450) {
        const batch = writeBatch(db);
        snap.docs.slice(i, i + 450).forEach((d) => batch.delete(d.ref));
        await batch.commit();
    }
}

function Section({ title, danger = false, children }) {
    const id = useId();
    return (
        <section className={`panel ${danger ? "panel-danger" : ""}`} aria-labelledby={id}>
            <div className="panel-head">
                <h2 className="panel-title" id={id}>
                    {title}
                </h2>
            </div>
            {children}
        </section>
    );
}

export default function Settings() {
    const { user, refresh } = useAuth();
    const notify = useToast();
    const { transactions } = useTransactions(user.uid);
    const id = useId();
    const passwordUser = hasPassword(user);
    const [searchParams, setSearchParams] = useSearchParams();

    // กลับมาจากหน้า LINE (เชื่อมบัญชี) -> แจ้งผลครั้งเดียวแล้วล้าง query
    useEffect(() => {
        const linked = searchParams.get("line") === "linked";
        const lineError = lineErrorMessage(searchParams.get("line_error"));
        if (!linked && !lineError) return;
        notify(linked ? "เชื่อมบัญชี LINE แล้ว" : lineError, linked ? "success" : "danger");
        setSearchParams({}, { replace: true });
    }, [searchParams, setSearchParams, notify]);

    // โปรไฟล์
    const [name, setName] = useState(user.displayName || "");
    const saveName = async (e) => {
        e.preventDefault();
        if (!name.trim()) return notify("กรุณากรอกชื่อ", "danger");
        try {
            await updateProfile(user, { displayName: name.trim() });
            await refresh();
            notify("บันทึกชื่อแล้ว");
        } catch (err) {
            notify(errorMessage(err), "danger");
        }
    };

    // ยืนยันอีเมล
    const [sending, setSending] = useState(false);
    const sendVerify = async () => {
        try {
            setSending(true);
            await sendEmailVerification(user);
            notify("ส่งอีเมลยืนยันแล้ว กรุณาเช็คกล่องจดหมาย (และโฟลเดอร์ Spam)");
        } catch (err) {
            notify(errorMessage(err), "danger");
        } finally {
            setSending(false);
        }
    };
    const checkVerified = async () => {
        await refresh();
        notify(
            auth.currentUser?.emailVerified ? "ยืนยันอีเมลเรียบร้อย" : "ยังไม่ได้ยืนยัน กรุณากดลิงก์ในอีเมลก่อน",
            auth.currentUser?.emailVerified ? "success" : "warning"
        );
    };

    // เปลี่ยนรหัสผ่าน
    const [pw, setPw] = useState({ current: "", next: "", confirm: "" });
    const [pwBusy, setPwBusy] = useState(false);
    const changePassword = async (e) => {
        e.preventDefault();
        if (pw.next.length < 6) return notify("รหัสผ่านใหม่ต้องมีอย่างน้อย 6 ตัวอักษร", "danger");
        if (pw.next !== pw.confirm) return notify("รหัสผ่านใหม่ไม่ตรงกัน", "danger");
        try {
            setPwBusy(true);
            await reauth(user, pw.current);
            await updatePassword(user, pw.next);
            setPw({ current: "", next: "", confirm: "" });
            notify("เปลี่ยนรหัสผ่านแล้ว");
        } catch (err) {
            notify(errorMessage(err), "danger");
        } finally {
            setPwBusy(false);
        }
    };

    // ลบบัญชี
    const [del, setDel] = useState({ password: "", confirm: "" });
    const [delBusy, setDelBusy] = useState(false);
    const [needsRelogin, setNeedsRelogin] = useState(false);
    const deleteAccount = async (e) => {
        e.preventDefault();
        if (!navigator.onLine) return notify("ต้องเชื่อมต่ออินเทอร์เน็ตก่อนลบบัญชี", "danger");
        if (del.confirm !== "ลบบัญชี") return notify('กรุณาพิมพ์คำว่า "ลบบัญชี" ให้ถูกต้อง', "danger");
        // บัญชี LINE อย่างเดียวยืนยันด้วยรหัสผ่านไม่ได้ -> ต้อง login มาไม่นาน
        // เช็กก่อนลบอะไร ไม่งั้นข้อมูลหายแต่ลบบัญชีไม่ผ่าน
        if (!passwordUser) {
            setDelBusy(true);
            const fresh = await user.getIdTokenResult(true).then(isRecentSignIn).catch(() => false);
            if (!fresh) {
                setDelBusy(false);
                return setNeedsRelogin(true);
            }
        }
        try {
            setDelBusy(true);
            if (passwordUser) await reauth(user, del.password);
            await deleteAllOwned("transactions", user.uid);
            await deleteAllOwned("recurring", user.uid);
            await deleteAllOwned("lineDrafts", user.uid);
            await deleteAllOwned("lineLinks", user.uid);
            const batch = writeBatch(db);
            batch.delete(doc(db, "budgets", user.uid));
            batch.delete(doc(db, "lineDicts", user.uid));
            await batch.commit();
            await deleteUser(user);
            notify("ลบบัญชีและข้อมูลทั้งหมดแล้ว");
        } catch (err) {
            if (err?.code === "auth/requires-recent-login" && !passwordUser) setNeedsRelogin(true);
            notify(errorMessage(err), "danger");
            setDelBusy(false);
        }
    };

    return (
        <div className="settings">
            <header className="band settings-band">
                <Guilloche />
                <div className="band-top">
                    <Link to="/dashboard" className="btn band-ctl icon-btn" aria-label="กลับหน้าหลัก" title="กลับหน้าหลัก">
                        <ArrowLeft size={20} aria-hidden="true" />
                    </Link>
                </div>
                <h1>ตั้งค่าบัญชี</h1>
                <p>{[user.displayName, user.email].filter(Boolean).join(" · ")}</p>
            </header>

            <Section title="โปรไฟล์">
                <form onSubmit={saveName}>
                    <label className="form-label" htmlFor={`${id}-name`}>
                        ชื่อที่แสดง
                    </label>
                    <div className="d-flex gap-2">
                        <input
                            id={`${id}-name`}
                            className="form-control"
                            maxLength={50}
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                        />
                        <button type="submit" className="btn btn-primary flex-shrink-0">
                            บันทึก
                        </button>
                    </div>
                </form>

                {user.email && (
                    <div className="mt-4">
                        <span className="form-label d-block">อีเมล</span>
                        <div className="d-flex flex-wrap align-items-center gap-2">
                            <span className="text-break">{user.email}</span>
                            {user.emailVerified ? (
                                <span className="badge-state is-ok">
                                    <CircleCheck size={15} aria-hidden="true" />
                                    ยืนยันแล้ว
                                </span>
                            ) : (
                                <span className="badge-state is-warn">
                                    <TriangleAlert size={15} aria-hidden="true" />
                                    ยังไม่ยืนยัน
                                </span>
                            )}
                        </div>
                        {!user.emailVerified && (
                            <div className="d-flex flex-wrap gap-2 mt-2">
                                <button className="btn btn-ghost btn-sm" onClick={sendVerify} disabled={sending}>
                                    {sending ? "กำลังส่ง..." : "ส่งอีเมลยืนยัน"}
                                </button>
                                <button className="btn btn-quiet btn-sm" onClick={checkVerified}>
                                    ฉันยืนยันแล้ว
                                </button>
                            </div>
                        )}
                    </div>
                )}
            </Section>

            <Section title="LINE">
                <LineSection user={user} canUnlink={passwordUser} notify={notify} />
            </Section>

            {passwordUser && (
                <Section title="เปลี่ยนรหัสผ่าน">
                    <form onSubmit={changePassword} className="form-stack">
                        {/* ช่อง username ซ่อนไว้ให้ password manager รู้ว่าบัญชีไหน */}
                        <input type="email" autoComplete="username" value={user.email} readOnly hidden />
                        <div>
                            <label className="form-label" htmlFor={`${id}-pw-current`}>
                                รหัสผ่านปัจจุบัน
                            </label>
                            <input
                                id={`${id}-pw-current`}
                                className="form-control"
                                type="password"
                                autoComplete="current-password"
                                value={pw.current}
                                onChange={(e) => setPw({ ...pw, current: e.target.value })}
                                required
                            />
                        </div>
                        <div className="form-row-2">
                            <div>
                                <label className="form-label" htmlFor={`${id}-pw-next`}>
                                    รหัสผ่านใหม่
                                </label>
                                <input
                                    id={`${id}-pw-next`}
                                    className="form-control"
                                    type="password"
                                    autoComplete="new-password"
                                    placeholder="อย่างน้อย 6 ตัว"
                                    value={pw.next}
                                    onChange={(e) => setPw({ ...pw, next: e.target.value })}
                                    required
                                />
                            </div>
                            <div>
                                <label className="form-label" htmlFor={`${id}-pw-confirm`}>
                                    ยืนยันรหัสผ่านใหม่
                                </label>
                                <input
                                    id={`${id}-pw-confirm`}
                                    className="form-control"
                                    type="password"
                                    autoComplete="new-password"
                                    value={pw.confirm}
                                    onChange={(e) => setPw({ ...pw, confirm: e.target.value })}
                                    required
                                />
                            </div>
                        </div>
                        <button type="submit" className="btn btn-primary" disabled={pwBusy}>
                            {pwBusy ? "กำลังบันทึก..." : "เปลี่ยนรหัสผ่าน"}
                        </button>
                    </form>
                </Section>
            )}

            <Section title="ข้อมูลของฉัน">
                <p className="muted mb-3">
                    ดาวน์โหลดรายการทั้งหมด {transactions.length.toLocaleString("th-TH")} รายการ เป็นไฟล์ CSV
                    เปิดใน Excel หรือ Google Sheets ได้
                </p>
                <button
                    className="btn btn-ghost w-100"
                    disabled={transactions.length === 0}
                    onClick={() => exportCsv(transactions, `transactions-all-${toInputDate(new Date())}.csv`)}
                >
                    <Download size={16} aria-hidden="true" />
                    ส่งออกข้อมูลทั้งหมด (CSV)
                </button>
            </Section>

            <div className="panel">
                <button className="btn btn-ghost w-100" onClick={() => signOut(auth)}>
                    <LogOut size={16} aria-hidden="true" />
                    ออกจากระบบ
                </button>
            </div>

            <Section title="ลบบัญชี" danger>
                <p className="mb-3">
                    ลบบัญชีและข้อมูลทั้งหมด (รายการ งบประมาณ รายการประจำ การเชื่อม LINE) อย่างถาวร
                    <strong> กู้คืนไม่ได้</strong> แนะนำให้ส่งออกข้อมูลเก็บไว้ก่อน
                </p>
                <form onSubmit={deleteAccount} className="form-stack">
                    {passwordUser && (
                        <div>
                            <label className="form-label" htmlFor={`${id}-del-pw`}>
                                รหัสผ่านปัจจุบัน
                            </label>
                            <input
                                id={`${id}-del-pw`}
                                className="form-control"
                                type="password"
                                autoComplete="current-password"
                                value={del.password}
                                onChange={(e) => setDel({ ...del, password: e.target.value })}
                                required
                            />
                        </div>
                    )}
                    <div>
                        <label className="form-label" htmlFor={`${id}-del-confirm`}>
                            พิมพ์คำว่า “ลบบัญชี” เพื่อยืนยัน
                        </label>
                        <input
                            id={`${id}-del-confirm`}
                            className="form-control"
                            autoComplete="off"
                            value={del.confirm}
                            onChange={(e) => setDel({ ...del, confirm: e.target.value })}
                            required
                        />
                    </div>
                    {needsRelogin && (
                        <>
                            <div className="form-error is-warn" role="status">
                                <Clock size={16} aria-hidden="true" />
                                <span>เพื่อความปลอดภัย กรุณาเข้าสู่ระบบด้วย LINE อีกครั้งก่อนลบบัญชี</span>
                            </div>
                            <LineButton returnTo="/settings" onError={(m) => notify(m, "danger")}>
                                เข้าสู่ระบบด้วย LINE อีกครั้ง
                            </LineButton>
                        </>
                    )}
                    <button
                        type="submit"
                        className="btn btn-danger w-100"
                        disabled={delBusy || del.confirm !== "ลบบัญชี"}
                    >
                        {delBusy ? "กำลังลบ..." : "ลบบัญชีถาวร"}
                    </button>
                </form>
            </Section>
        </div>
    );
}
