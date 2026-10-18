import { useEffect, useId, useState } from "react";
import { EmailAuthProvider, reauthenticateWithCredential } from "firebase/auth";
import { collection, deleteDoc, doc, getDocs, limit, query, where } from "firebase/firestore";
import { CircleCheck } from "lucide-react";
import { auth, db } from "../firebase/config";
import { errorMessage } from "../firebase/errors";
import LineButton from "./LineButton";

const ADD_FRIEND_URL = process.env.REACT_APP_LINE_ADD_FRIEND_URL;

// ส่วน "LINE" ในหน้าตั้งค่า: เชื่อม/ยกเลิกการเชื่อม และลิงก์เพิ่มเพื่อนบอท
export default function LineSection({ user, canUnlink, notify }) {
    const [link, setLink] = useState(undefined); // undefined = กำลังโหลด, null = ยังไม่เชื่อม, "error" = โหลดไม่ได้
    const [busy, setBusy] = useState(false);
    const [password, setPassword] = useState("");
    const id = useId();

    useEffect(() => {
        let alive = true;
        getDocs(query(collection(db, "lineLinks"), where("userId", "==", user.uid), limit(1)))
            .then((snap) => alive && setLink(snap.empty ? null : { id: snap.docs[0].id, ...snap.docs[0].data() }))
            .catch(() => alive && setLink("error"));
        return () => {
            alive = false;
        };
    }, [user.uid]);

    const unlink = async () => {
        try {
            setBusy(true);
            await deleteDoc(doc(db, "lineLinks", link.id));
            setLink(null);
            notify("ยกเลิกการเชื่อม LINE แล้ว");
        } catch (err) {
            notify(errorMessage(err), "danger");
        } finally {
            setBusy(false);
        }
    };

    if (link === undefined) return <p className="muted mb-0">กำลังโหลด...</p>;

    if (link === "error") {
        return <p className="muted mb-0">โหลดสถานะการเชื่อม LINE ไม่ได้ ลองใหม่อีกครั้งภายหลัง</p>;
    }

    if (!link) {
        // บัญชีอีเมล: ยืนยันรหัสผ่านก่อน (server ยอมเชื่อมเฉพาะเมื่อ login มาไม่เกิน 5 นาที)
        const reauth = () =>
            reauthenticateWithCredential(
                auth.currentUser,
                EmailAuthProvider.credential(auth.currentUser.email, password)
            );
        return (
            <>
                <p className="muted mb-3">
                    เชื่อมบัญชี LINE เพื่อจดรายรับ-รายจ่ายผ่านแชท LINE ได้ทันที เช่น พิมพ์ “ค่าข้าว 50”
                    {canUnlink && " (กรอกรหัสผ่านเพื่อยืนยันตัวตนก่อนเชื่อม)"}
                </p>
                {canUnlink && (
                    <div className="mb-3">
                        <label className="form-label" htmlFor={`${id}-line-pw`}>
                            รหัสผ่านปัจจุบัน
                        </label>
                        <input
                            id={`${id}-line-pw`}
                            className="form-control"
                            type="password"
                            autoComplete="current-password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                        />
                    </div>
                )}
                <LineButton
                    mode="link"
                    prepare={canUnlink ? reauth : undefined}
                    disabled={canUnlink && !password}
                    onError={(m) => notify(m, "danger")}
                >
                    เชื่อมบัญชี LINE
                </LineButton>
            </>
        );
    }

    return (
        <>
            <div className="d-flex flex-wrap align-items-center gap-2 mb-3">
                <span>
                    เชื่อมกับ LINE: <strong>{link.displayName || "บัญชี LINE"}</strong>
                </span>
                <span className="badge-state is-ok">
                    <CircleCheck size={15} aria-hidden="true" />
                    เชื่อมแล้ว
                </span>
            </div>
            {!canUnlink && <p className="muted mb-3">บัญชีนี้เข้าสู่ระบบด้วย LINE</p>}
            <div className="d-flex flex-wrap gap-2">
                {ADD_FRIEND_URL && (
                    <a className="btn btn-ghost" href={ADD_FRIEND_URL} target="_blank" rel="noopener noreferrer">
                        เพิ่มเพื่อนบอท
                    </a>
                )}
                {canUnlink && (
                    <button type="button" className="btn btn-quiet" onClick={unlink} disabled={busy}>
                        {busy ? "กำลังยกเลิก..." : "ยกเลิกการเชื่อม"}
                    </button>
                )}
            </div>
        </>
    );
}
