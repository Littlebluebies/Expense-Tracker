import { useState } from "react";
import { deleteField, doc, setDoc } from "firebase/firestore";
import { db } from "../firebase/config";
import { commit } from "../firebase/write";
import { EXPENSE_CATEGORIES, getCategory } from "../constants/categories";
import { budgetStatus, formatMoney } from "../utils/format";
import { CategoryTile } from "./CategoryIcon";
import Money from "./Money";
import StatusLabel from "./StatusLabel";

const TONE_ORDER = { over: 0, near: 1, ok: 2 };

// รายจ่ายตามหมวด + งบรายหมวด (งบใช้เหมือนกันทุกเดือน) ในรายชื่อเดียวกัน
// หมวดที่เกิน/ใกล้เต็มงบขึ้นก่อน ที่เหลือเรียงตามยอดใช้ แตะหมวดเพื่อกรองรายการ
export default function CategoryCard({ uid, limits, spent, monthBudget, notify, activeKey, onPick }) {
    const [editing, setEditing] = useState(false);
    const [inputs, setInputs] = useState({});

    const startEdit = () => {
        setInputs(
            Object.fromEntries(
                EXPENSE_CATEGORIES.map((c) => [c.key, limits[c.key] ? String(limits[c.key]) : ""])
            )
        );
        setEditing(true);
    };

    const save = (e) => {
        e.preventDefault();
        const categories = {};
        EXPENSE_CATEGORIES.forEach(({ key }) => {
            const value = Number(inputs[key]);
            // ช่องว่าง/0 = ไม่ตั้งงบหมวดนี้
            categories[key] = inputs[key] && value > 0 ? value : deleteField();
        });
        commit(setDoc(doc(db, "budgets", uid), { categories }, { merge: true }), notify);
        setEditing(false);
        notify("บันทึกงบรายหมวดแล้ว");
    };

    const total = Object.values(spent).reduce((s, v) => s + v, 0);
    const keys = new Set([
        ...Object.keys(spent),
        ...Object.keys(limits).filter((k) => limits[k] > 0),
    ]);
    const rows = [...keys]
        .map((key) => {
            const used = spent[key] || 0;
            const limit = limits[key] > 0 ? limits[key] : 0;
            const percent = limit ? (used / limit) * 100 : null;
            return {
                key,
                used,
                limit,
                percent,
                share: total ? (used / total) * 100 : 0,
                status: limit ? budgetStatus(percent) : null,
            };
        })
        .sort((a, b) => {
            const ta = a.status && a.status.tone !== "ok" ? TONE_ORDER[a.status.tone] : 2;
            const tb = b.status && b.status.tone !== "ok" ? TONE_ORDER[b.status.tone] : 2;
            return ta - tb || b.used - a.used;
        });

    const hasLimits = rows.some((r) => r.limit);
    const totalLimits = rows.reduce((s, r) => s + r.limit, 0);
    const editTotal = Object.values(inputs).reduce((s, v) => s + (Number(v) || 0), 0);

    return (
        <section className="panel" aria-labelledby="cat-title">
            <div className="panel-head">
                <h2 className="panel-title" id="cat-title">
                    หมวดหมู่
                </h2>
                {!editing && (
                    <button className="btn btn-ghost btn-sm" onClick={startEdit}>
                        {hasLimits ? "แก้ไขงบหมวด" : "ตั้งงบหมวด"}
                    </button>
                )}
            </div>

            {editing ? (
                <form onSubmit={save}>
                    <p className="form-hint mt-0 mb-2">ใส่งบต่อเดือนของแต่ละหมวด เว้นว่างไว้ = ไม่จำกัด</p>
                    {EXPENSE_CATEGORIES.map((c) => (
                        <div key={c.key} className="cat-edit-row">
                            <CategoryTile category={c.key} />
                            <label className="row-label" htmlFor={`limit-${c.key}`}>
                                {c.label}
                            </label>
                            <div className="field-money">
                                <input
                                    id={`limit-${c.key}`}
                                    className="form-control"
                                    inputMode="decimal"
                                    autoComplete="off"
                                    placeholder="ไม่จำกัด"
                                    value={inputs[c.key]}
                                    onChange={(e) => {
                                        const v = e.target.value.replace(/,/g, "");
                                        if (/^\d*\.?\d{0,2}$/.test(v)) {
                                            setInputs((s) => ({ ...s, [c.key]: v }));
                                        }
                                    }}
                                />
                                <span className="unit" aria-hidden="true">
                                    ฿
                                </span>
                            </div>
                        </div>
                    ))}
                    <p className="form-hint">
                        รวม {formatMoney(editTotal)}
                        {monthBudget > 0 && editTotal > monthBudget && (
                            <span className="is-warn fw-semibold">
                                {" "}
                                มากกว่างบรวมของเดือน ({formatMoney(monthBudget)})
                            </span>
                        )}
                    </p>
                    <div className="form-actions">
                        <button type="submit" className="btn btn-primary">
                            บันทึก
                        </button>
                        <button type="button" className="btn btn-ghost" onClick={() => setEditing(false)}>
                            ยกเลิก
                        </button>
                    </div>
                </form>
            ) : rows.length === 0 ? (
                <p className="empty">
                    <strong>ยังไม่มีรายจ่ายในเดือนนี้</strong>
                    <br />
                    ตั้งงบให้แต่ละหมวด เช่น อาหาร 6,000 ฿ เพื่อดูว่าเงินรั่วไปที่หมวดไหน
                </p>
            ) : (
                <>
                    {rows.map((r) => {
                        const cat = getCategory(r.key);
                        const active = activeKey === r.key;
                        const left = r.limit - r.used;
                        return (
                            <button
                                key={r.key}
                                type="button"
                                className={`cat-row ${active ? "is-active" : ""}`}
                                aria-pressed={active}
                                onClick={() => onPick(r.key)}
                            >
                                <CategoryTile category={r.key} />
                                <span className="row-label">{cat.label}</span>
                                <Money value={r.used} />
                                <span className="meter-wrap">
                                    {r.limit ? (
                                        <>
                                            <span
                                                className="meter is-thin d-block"
                                                role="progressbar"
                                                aria-label={`งบ ${cat.label}`}
                                                aria-valuenow={Math.round(r.percent)}
                                                aria-valuemin={0}
                                                aria-valuemax={100}
                                            >
                                                <span
                                                    className={`meter-fill tone-${r.status.tone}`}
                                                    style={{ width: `${Math.min(r.percent, 100)}%` }}
                                                />
                                            </span>
                                            <span className="meter-caption">
                                                <span>
                                                    {left >= 0
                                                        ? `เหลือ ${formatMoney(left)} จาก ${formatMoney(r.limit)}`
                                                        : `เกิน ${formatMoney(-left)} จากงบ ${formatMoney(r.limit)}`}
                                                </span>
                                                {r.status.tone !== "ok" && <StatusLabel status={r.status} />}
                                            </span>
                                        </>
                                    ) : (
                                        <>
                                            <span
                                                className="share"
                                                style={{ width: `${Math.max(r.share, 1)}%` }}
                                                aria-hidden="true"
                                            />
                                            <span className="meter-caption">
                                                <span>{Math.round(r.share)}% ของรายจ่าย</span>
                                            </span>
                                        </>
                                    )}
                                </span>
                            </button>
                        );
                    })}
                    <p className="form-hint">แตะหมวดเพื่อดูเฉพาะรายการของหมวดนั้น</p>
                    {monthBudget > 0 && totalLimits > monthBudget && (
                        <p className="form-hint is-warn fw-semibold">
                            งบรายหมวดรวม {formatMoney(totalLimits)} มากกว่างบเดือน ({formatMoney(monthBudget)})
                        </p>
                    )}
                </>
            )}
        </section>
    );
}
