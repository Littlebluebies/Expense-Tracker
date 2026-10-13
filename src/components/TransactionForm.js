import { useEffect, useId, useState } from "react";
import { Trash2 } from "lucide-react";
import { doc, updateDoc } from "firebase/firestore";
import { db } from "../firebase/config";
import { commit } from "../firebase/write";
import { addTransaction } from "../firebase/transactions";
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES } from "../constants/categories";
import { fromInputDate, toInputDate } from "../utils/format";
import CategoryPicker from "./CategoryPicker";
import Segmented from "./Segmented";

const emptyForm = () => ({
    type: "expense",
    amount: "",
    category: EXPENSE_CATEGORIES[0].key,
    date: toInputDate(new Date()),
    note: "",
});

const TYPES = [
    { value: "expense", label: "รายจ่าย" },
    { value: "income", label: "รายรับ", className: "is-income" },
];

export default function TransactionForm({ uid, editing, onDone, onCancel, onDelete, notify }) {
    const [form, setForm] = useState(emptyForm);
    const id = useId();

    const now = new Date();
    const today = toInputDate(now);
    const yesterday = toInputDate(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1));

    // เปิดโหมดแก้ไข -> เติมค่าลงฟอร์ม
    useEffect(() => {
        if (editing) {
            setForm({
                type: editing.type,
                amount: String(editing.amount),
                category: editing.category,
                date: toInputDate(editing.date),
                note: editing.note || "",
            });
        } else {
            setForm(emptyForm());
        }
    }, [editing]);

    const set = (field, value) => setForm((f) => ({ ...f, [field]: value }));

    const changeType = (type) =>
        setForm((f) => ({
            ...f,
            type,
            category: (type === "expense" ? EXPENSE_CATEGORIES : INCOME_CATEGORIES)[0].key,
        }));

    const submit = (e) => {
        e.preventDefault();
        const amount = Number(form.amount);
        if (!form.amount || Number.isNaN(amount) || amount <= 0) {
            notify("กรุณากรอกจำนวนเงินมากกว่า 0", "danger");
            return;
        }
        if (!form.date) {
            notify("กรุณาเลือกวันที่", "danger");
            return;
        }

        const data = {
            amount: Math.round(amount * 100) / 100,
            type: form.type,
            category: form.category,
            date: fromInputDate(form.date),
            note: form.note.trim(),
        };

        if (editing) {
            commit(updateDoc(doc(db, "transactions", editing.id), data), notify);
            notify("แก้ไขรายการแล้ว");
        } else {
            addTransaction(uid, data, notify);
        }
        // คงประเภท/หมวด/วันที่ไว้ เผื่อจดหลายรายการติดกัน
        setForm((f) => ({ ...f, amount: "", note: "" }));
        onDone(fromInputDate(form.date));
    };

    return (
        <form className="form-stack" onSubmit={submit} id="transaction-form" noValidate>
            <Segmented
                label="ประเภท"
                value={form.type}
                onChange={changeType}
                options={TYPES}
                block
            />

            <div>
                <label className="form-label" htmlFor={`${id}-amount`}>
                    จำนวนเงิน
                </label>
                <div className="field-money is-large">
                    <input
                        id={`${id}-amount`}
                        className="form-control"
                        inputMode="decimal"
                        autoComplete="off"
                        placeholder="0"
                        value={form.amount}
                        data-autofocus
                        onChange={(e) => {
                            const v = e.target.value.replace(/,/g, "");
                            if (/^\d*\.?\d{0,2}$/.test(v)) set("amount", v);
                        }}
                    />
                    <span className="unit" aria-hidden="true">
                        ฿
                    </span>
                </div>
            </div>

            <div>
                <span className="form-label d-block">หมวดหมู่</span>
                <CategoryPicker
                    type={form.type}
                    value={form.category}
                    onChange={(v) => set("category", v)}
                />
            </div>

            <div>
                <label className="form-label" htmlFor={`${id}-note`}>
                    บันทึก <span className="fw-normal">(ไม่บังคับ)</span>
                </label>
                <input
                    id={`${id}-note`}
                    className="form-control"
                    placeholder="เช่น ข้าวกลางวัน"
                    maxLength={100}
                    value={form.note}
                    onChange={(e) => set("note", e.target.value)}
                />
            </div>

            <div>
                <div className="d-flex justify-content-between align-items-center gap-2 mb-1">
                    <label className="form-label mb-0" htmlFor={`${id}-date`}>
                        วันที่
                    </label>
                    <div className="date-picks" role="group" aria-label="เลือกวันที่ด่วน">
                        {[
                            ["วันนี้", today],
                            ["เมื่อวาน", yesterday],
                        ].map(([label, value]) => (
                            <button
                                key={label}
                                type="button"
                                className="date-pick"
                                aria-pressed={form.date === value}
                                onClick={() => set("date", value)}
                            >
                                {label}
                            </button>
                        ))}
                    </div>
                </div>
                <input
                    id={`${id}-date`}
                    type="date"
                    className="form-control"
                    value={form.date}
                    max={today}
                    aria-describedby={`${id}-date-th`}
                    onChange={(e) => set("date", e.target.value)}
                />
                {form.date && (
                    <p className="form-hint" id={`${id}-date-th`}>
                        {fromInputDate(form.date).toLocaleDateString("th-TH", {
                            weekday: "long",
                            day: "numeric",
                            month: "long",
                            year: "numeric",
                        })}
                    </p>
                )}
            </div>

            <div className="form-actions">
                <button type="submit" className="btn btn-primary">
                    {editing ? "บันทึกการแก้ไข" : "เพิ่มรายการ"}
                </button>
                {editing && onDelete && (
                    <button type="button" className="btn btn-danger-ghost" onClick={() => onDelete(editing)}>
                        <Trash2 size={16} aria-hidden="true" />
                        ลบ
                    </button>
                )}
                {(editing || onCancel) && (
                    <button
                        type="button"
                        className="btn btn-ghost"
                        onClick={() => (onCancel ? onCancel() : onDone())}
                    >
                        ยกเลิก
                    </button>
                )}
            </div>
        </form>
    );
}
