import { useId, useState } from "react";
import { doc, setDoc } from "firebase/firestore";
import { db } from "../firebase/config";
import { commit } from "../firebase/write";
import { getCategory } from "../constants/categories";
import { budgetStatus, daysInMonth, formatMoney, monthKey, monthLabel } from "../utils/format";
import CategoryIcon from "./CategoryIcon";
import Money from "./Money";
import NoteStack from "./NoteStack";
import StatusLabel from "./StatusLabel";

export default function BudgetCard({ uid, month, budget, isCustom, expense, topCategory, notify }) {
    const [editing, setEditing] = useState(false);
    const [input, setInput] = useState("");
    const [asDefault, setAsDefault] = useState(false);
    const id = useId();

    const startEdit = () => {
        setInput(budget ? String(budget) : "");
        setAsDefault(!isCustom);
        setEditing(true);
    };

    const save = (e) => {
        e.preventDefault();
        const value = Number(input);
        if (input === "" || Number.isNaN(value) || value < 0) {
            notify("กรุณากรอกงบประมาณให้ถูกต้อง", "danger");
            return;
        }
        // merge: true -> ไม่ทับงบของเดือนอื่น
        commit(
            setDoc(
                doc(db, "budgets", uid),
                asDefault ? { budget: value, monthly: { [month]: null } } : { monthly: { [month]: value } },
                { merge: true }
            ),
            notify
        );
        setEditing(false);
        notify("บันทึกงบประมาณแล้ว");
    };

    const remaining = budget - expense;
    const percent = budget > 0 ? (expense / budget) * 100 : 0;
    const status = budgetStatus(percent);

    // งบที่ใช้ได้ต่อวันที่เหลือ (เฉพาะเดือนปัจจุบัน)
    const today = new Date();
    const isCurrentMonth = monthKey(today) === month;
    const totalDays = daysInMonth(month);
    const daysLeft = isCurrentMonth ? totalDays - today.getDate() + 1 : 0;
    const perDay = daysLeft > 0 && remaining > 0 ? Math.floor(remaining / daysLeft) : 0;
    const pace = isCurrentMonth ? (today.getDate() / totalDays) * 100 : null;

    const top = topCategory && getCategory(topCategory);

    return (
        <>
            {budget > 0 && isCurrentMonth && (
                <section className="panel panel-today" aria-labelledby={`${id}-today`}>
                    <div className="panel-head mb-1">
                        <h2 className="panel-title" id={`${id}-today`}>
                            ใช้ได้อีกวันละ
                        </h2>
                        <span className="panel-meta">อีก {daysLeft} วันถึงสิ้นเดือน</span>
                    </div>
                    <div className="today-figure">
                        <Money value={perDay} size="lg" className={perDay === 0 ? "is-danger" : ""} />
                        {perDay > 0 ? (
                            <NoteStack key={perDay} amount={perDay} />
                        ) : (
                            <p className="empty today-out">
                                งบเดือนนี้หมดแล้ว
                                {top && (
                                    <>
                                        <br />
                                        ใช้มากสุดที่หมวด{top.label}
                                    </>
                                )}
                            </p>
                        )}
                    </div>
                </section>
            )}

            <section className="panel" aria-labelledby={`${id}-budget`}>
                <div className="panel-head">
                    <h2 className="panel-title" id={`${id}-budget`}>
                        งบประมาณ {monthLabel(month, "short")}
                    </h2>
                    {!editing && (
                        <button className="btn btn-ghost btn-sm" onClick={startEdit}>
                            {budget > 0 ? "แก้ไข" : "ตั้งงบ"}
                        </button>
                    )}
                </div>

                {editing && (
                    <form onSubmit={save} className="form-stack mb-3">
                        <div>
                            <label className="form-label" htmlFor={`${id}-input`}>
                                งบประมาณเดือนนี้
                            </label>
                            <div className="field-money">
                                <input
                                    id={`${id}-input`}
                                    className="form-control"
                                    inputMode="decimal"
                                    autoComplete="off"
                                    placeholder="เช่น 15000"
                                    value={input}
                                    onChange={(e) => {
                                        const v = e.target.value.replace(/,/g, "");
                                        if (/^\d*\.?\d{0,2}$/.test(v)) setInput(v);
                                    }}
                                    autoFocus
                                />
                                <span className="unit" aria-hidden="true">
                                    ฿
                                </span>
                            </div>
                        </div>
                        <div className="form-check">
                            <input
                                id={`${id}-default`}
                                type="checkbox"
                                className="form-check-input"
                                checked={asDefault}
                                onChange={(e) => setAsDefault(e.target.checked)}
                            />
                            <label htmlFor={`${id}-default`} className="form-check-label">
                                ใช้เป็นงบเริ่มต้นทุกเดือน (เดือนที่ไม่ได้ตั้งแยกไว้)
                            </label>
                        </div>
                        <div className="form-actions mt-0">
                            <button type="submit" className="btn btn-primary">
                                บันทึก
                            </button>
                            <button type="button" className="btn btn-ghost" onClick={() => setEditing(false)}>
                                ยกเลิก
                            </button>
                        </div>
                    </form>
                )}

                {budget > 0 ? (
                    <>
                        <div className="d-flex justify-content-between align-items-baseline gap-2 flex-wrap">
                            <span>
                                <Money value={expense} size="md" />
                                <span className="muted"> / {formatMoney(budget)}</span>
                            </span>
                            <StatusLabel status={status} />
                        </div>

                        <div
                            className="meter"
                            role="progressbar"
                            aria-label="ใช้งบไปแล้ว"
                            aria-valuenow={Math.round(percent)}
                            aria-valuemin={0}
                            aria-valuemax={100}
                            aria-valuetext={`${Math.round(percent)}% ${status.text}${pace !== null ? ` ผ่านไปแล้ว ${Math.round(pace)}% ของเดือน` : ""}`}
                        >
                            <span
                                className={`meter-fill tone-${status.tone}`}
                                style={{ width: `${Math.min(percent, 100)}%` }}
                            />
                            {pace !== null && <span className="meter-pace" style={{ left: `${pace}%` }} />}
                        </div>

                        <div className="meter-caption">
                            <span>
                                ใช้ไป {Math.round(percent)}%{!isCustom && " ของงบเริ่มต้น"}
                                {pace !== null && (
                                    <>
                                        {" · "}
                                        <span className="pace-key" aria-hidden="true" />
                                        วันที่ {today.getDate()}/{totalDays}
                                    </>
                                )}
                            </span>
                            <span>
                                {remaining >= 0 ? (
                                    <>เหลือ {formatMoney(remaining)}</>
                                ) : (
                                    <span className="is-danger fw-semibold">เกินมา {formatMoney(-remaining)}</span>
                                )}
                            </span>
                        </div>

                        {percent > 100 && top && (
                            <p className="form-hint d-flex align-items-center gap-1">
                                หมวดที่ใช้มากที่สุด:
                                <CategoryIcon category={top.key} size={15} />
                                <span className="fw-semibold">{top.label}</span>
                            </p>
                        )}

                    </>
                ) : (
                    !editing && (
                        <p className="empty">
                            ยังไม่ได้ตั้งงบสำหรับเดือนนี้ ใช้ไปแล้ว {formatMoney(expense)}
                            <br />
                            ตั้งงบแล้วจะเห็นว่าเหลือใช้ได้วันละเท่าไหร่
                        </p>
                    )
                )}
            </section>
        </>
    );
}
