import { useId, useState } from "react";
import { addDoc, collection, deleteDoc, doc, serverTimestamp, updateDoc } from "firebase/firestore";
import { ChevronDown, Pause, Pencil, Play, Plus, Trash2 } from "lucide-react";
import { db } from "../firebase/config";
import { commit } from "../firebase/write";
import { getCategory } from "../constants/categories";
import { monthKey, shiftMonth } from "../utils/format";
import { dueDate, nextMonth } from "../utils/useRecurring";
import CategoryPicker from "./CategoryPicker";
import { CategoryTile } from "./CategoryIcon";
import Money from "./Money";
import Segmented from "./Segmented";

const DAYS = Array.from({ length: 31 }, (_, i) => i + 1);

const TYPES = [
    { value: "expense", label: "รายจ่าย" },
    { value: "income", label: "รายรับ", className: "is-income" },
];

const emptyForm = () => ({
    type: "expense",
    amount: "",
    category: "bills",
    day: String(new Date().getDate()),
    note: "",
    startNextMonth: false,
});

export default function RecurringCard({ uid, items, notify }) {
    const [open, setOpen] = useState(false);
    const [form, setForm] = useState(null); // null = ปิดฟอร์ม
    const [editingId, setEditingId] = useState(null);
    const id = useId();

    const set = (field, value) => setForm((f) => ({ ...f, [field]: value }));

    const openAdd = () => {
        setEditingId(null);
        setForm(emptyForm());
        setOpen(true);
    };

    const openEdit = (item) => {
        setEditingId(item.id);
        setForm({
            type: item.type,
            amount: String(item.amount),
            category: item.category,
            day: String(item.day),
            note: item.note || "",
            startNextMonth: false,
        });
    };

    const closeForm = () => {
        setForm(null);
        setEditingId(null);
    };

    const save = (e) => {
        e.preventDefault();
        const amount = Number(form.amount);
        if (!form.amount || Number.isNaN(amount) || amount <= 0) {
            notify("กรุณากรอกจำนวนเงินมากกว่า 0", "danger");
            return;
        }
        if (!form.note.trim()) {
            notify("กรุณาตั้งชื่อรายการ เช่น ค่าเช่าห้อง", "danger");
            return;
        }

        const data = {
            type: form.type,
            amount: Math.round(amount * 100) / 100,
            category: form.category,
            day: Number(form.day),
            note: form.note.trim(),
        };

        if (editingId) {
            // มีผลกับเดือนถัดๆ ไป รายการที่ลงไปแล้วไม่เปลี่ยน
            commit(updateDoc(doc(db, "recurring", editingId), data), notify);
            notify("แก้ไขรายการประจำแล้ว");
        } else {
            const current = monthKey(new Date());
            commit(
                addDoc(collection(db, "recurring"), {
                    ...data,
                    userId: uid,
                    active: true,
                    startMonth: form.startNextMonth ? shiftMonth(current, 1) : current,
                    lastPosted: null,
                    createdAt: serverTimestamp(),
                }),
                notify
            );
            notify("เพิ่มรายการประจำแล้ว");
        }
        closeForm();
    };

    const toggleActive = (item) => {
        const update = { active: !item.active };
        // เปิดใช้ใหม่: ไม่ย้อนลงเดือนที่หยุดไว้ (เริ่มนับตั้งแต่เดือนนี้)
        if (!item.active) {
            const prev = shiftMonth(monthKey(new Date()), -1);
            if (!item.lastPosted || item.lastPosted < prev) update.lastPosted = prev;
        }
        commit(updateDoc(doc(db, "recurring", item.id), update), notify);
    };

    const remove = (item) => {
        if (!window.confirm(`ลบรายการประจำ "${item.note}"?\n(รายการที่ลงไปแล้วจะยังอยู่)`)) return;
        commit(deleteDoc(doc(db, "recurring", item.id)), notify);
        if (editingId === item.id) closeForm();
        notify("ลบรายการประจำแล้ว");
    };

    const monthlyNet = items
        .filter((i) => i.active)
        .reduce((sum, i) => sum + (i.type === "income" ? i.amount : -i.amount), 0);

    return (
        <section className="panel" aria-labelledby={`${id}-title`}>
            <h2 className="m-0" id={`${id}-title`}>
                <button
                    type="button"
                    className="recurring-toggle"
                    onClick={() => setOpen((o) => !o)}
                    aria-expanded={open}
                    aria-controls={`${id}-body`}
                >
                    <span className="panel-title">
                        รายการประจำ<span className="count">{items.length}</span>
                    </span>
                    <span className="d-flex align-items-center gap-2 panel-meta">
                        {items.length > 0 && (
                            <span>
                                <Money value={monthlyNet} signed className={monthlyNet > 0 ? "is-income" : ""} />
                                /เดือน
                            </span>
                        )}
                        <ChevronDown size={18} className={`chev ${open ? "is-open" : ""}`} aria-hidden="true" />
                    </span>
                </button>
            </h2>

            {open && (
                <div className="mt-2" id={`${id}-body`}>
                    {items.length === 0 && !form && (
                        <p className="empty mb-2">
                            ตั้งรายการที่เกิดทุกเดือน เช่น ค่าเช่า ค่าเน็ต เงินเดือน
                            แอปจะลงรายการให้อัตโนมัติเมื่อถึงวันที่กำหนด
                        </p>
                    )}

                    {items.map((item) => {
                        const isIncome = item.type === "income";
                        return (
                            <div
                                key={item.id}
                                className={`row-item ${item.active ? "" : "is-paused"} ${editingId === item.id ? "is-editing" : ""}`}
                            >
                                <CategoryTile category={item.category} income={isIncome} />
                                <div className="min-w-0">
                                    <div className="row-label">{item.note}</div>
                                    <span className="row-sub">
                                        {item.active
                                            ? `ทุกวันที่ ${item.day} · ครั้งถัดไป ${dueDate(item, nextMonth(item)).toLocaleDateString("th-TH", { day: "numeric", month: "short" })}`
                                            : `หยุดไว้ · ${getCategory(item.category).label}`}
                                    </span>
                                </div>
                                <Money
                                    value={isIncome ? item.amount : -item.amount}
                                    signed={isIncome}
                                    className={`row-amount ${isIncome ? "is-income" : ""}`}
                                />
                                <div className="row-actions">
                                    <button
                                        className="btn btn-quiet btn-sm icon-btn"
                                        title={item.active ? "หยุดชั่วคราว" : "เปิดใช้"}
                                        aria-label={`${item.active ? "หยุดชั่วคราว" : "เปิดใช้"} ${item.note}`}
                                        onClick={() => toggleActive(item)}
                                    >
                                        {item.active ? (
                                            <Pause size={16} aria-hidden="true" />
                                        ) : (
                                            <Play size={16} aria-hidden="true" />
                                        )}
                                    </button>
                                    <button
                                        className="btn btn-quiet btn-sm icon-btn"
                                        title="แก้ไข"
                                        aria-label={`แก้ไข ${item.note}`}
                                        onClick={() => openEdit(item)}
                                    >
                                        <Pencil size={16} aria-hidden="true" />
                                    </button>
                                    <button
                                        className="btn btn-quiet btn-sm icon-btn"
                                        title="ลบ"
                                        aria-label={`ลบ ${item.note}`}
                                        onClick={() => remove(item)}
                                    >
                                        <Trash2 size={16} aria-hidden="true" />
                                    </button>
                                </div>
                            </div>
                        );
                    })}

                    {form ? (
                        <form onSubmit={save} className="form-stack recurring-form">
                            <h3 className="panel-title">{editingId ? "แก้ไขรายการประจำ" : "เพิ่มรายการประจำ"}</h3>
                            <Segmented
                                label="ประเภท"
                                value={form.type}
                                onChange={(type) =>
                                    setForm((f) => ({ ...f, type, category: type === "income" ? "salary" : "bills" }))
                                }
                                options={TYPES}
                                block
                            />

                            <div>
                                <label className="form-label" htmlFor={`${id}-name`}>
                                    ชื่อรายการ
                                </label>
                                <input
                                    id={`${id}-name`}
                                    className="form-control"
                                    placeholder="เช่น ค่าเช่าห้อง, Netflix"
                                    maxLength={100}
                                    value={form.note}
                                    onChange={(e) => set("note", e.target.value)}
                                />
                            </div>

                            <div className="form-row-2">
                                <div>
                                    <label className="form-label" htmlFor={`${id}-amount`}>
                                        จำนวนเงิน
                                    </label>
                                    <div className="field-money">
                                        <input
                                            id={`${id}-amount`}
                                            className="form-control"
                                            inputMode="decimal"
                                            autoComplete="off"
                                            placeholder="0"
                                            value={form.amount}
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
                                    <label className="form-label" htmlFor={`${id}-day`}>
                                        วันที่ของทุกเดือน
                                    </label>
                                    <select
                                        id={`${id}-day`}
                                        className="form-select"
                                        value={form.day}
                                        onChange={(e) => set("day", e.target.value)}
                                    >
                                        {DAYS.map((d) => (
                                            <option key={d} value={d}>
                                                ทุกวันที่ {d}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                            {Number(form.day) > 28 && (
                                <p className="form-hint mt-1">
                                    เดือนที่มีไม่ถึง {form.day} วัน จะลงวันสุดท้ายของเดือนแทน
                                </p>
                            )}

                            <div>
                                <span className="form-label d-block">หมวดหมู่</span>
                                <CategoryPicker type={form.type} value={form.category} onChange={(v) => set("category", v)} />
                            </div>

                            {!editingId && (
                                <div className="form-check">
                                    <input
                                        id={`${id}-next`}
                                        type="checkbox"
                                        className="form-check-input"
                                        checked={form.startNextMonth}
                                        onChange={(e) => set("startNextMonth", e.target.checked)}
                                    />
                                    <label htmlFor={`${id}-next`} className="form-check-label">
                                        เริ่มเดือนหน้า (เดือนนี้จดเองไปแล้ว)
                                    </label>
                                </div>
                            )}

                            <div className="form-actions">
                                <button type="submit" className="btn btn-primary">
                                    บันทึก
                                </button>
                                <button type="button" className="btn btn-ghost" onClick={closeForm}>
                                    ยกเลิก
                                </button>
                            </div>
                        </form>
                    ) : (
                        <button className="btn btn-ghost w-100 mt-3" onClick={openAdd}>
                            <Plus size={16} aria-hidden="true" />
                            เพิ่มรายการประจำ
                        </button>
                    )}
                </div>
            )}
        </section>
    );
}
