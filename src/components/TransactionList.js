import { useEffect, useRef, useState } from "react";
import { Download, Repeat, Search, X } from "lucide-react";
import { getCategory } from "../constants/categories";
import { formatMoney, toInputDate } from "../utils/format";
import { exportCsv } from "../utils/csv";
import { CategoryTile } from "./CategoryIcon";
import Money from "./Money";
import Segmented from "./Segmented";

const FILTERS = [
    { value: "all", label: "ทั้งหมด" },
    { value: "expense", label: "รายจ่าย" },
    { value: "income", label: "รายรับ" },
];

// มือถือ: แสดงรายการล่าสุดก่อน กดดูทั้งหมดได้
const COMPACT_ROWS = 6;

const dayLabel = (date) => {
    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(today.getDate() - 1);
    const text = date.toLocaleDateString("th-TH", { weekday: "short", day: "numeric", month: "short" });
    const key = toInputDate(date);
    if (key === toInputDate(today)) return { text: `วันนี้ · ${text}`, today: true };
    if (key === toInputDate(yesterday)) return { text: `เมื่อวาน · ${text}`, today: false };
    return { text, today: false };
};

export default function TransactionList({
    transactions,
    month,
    loading,
    editingId,
    onEdit,
    compact,
    categoryFilter,
    onClearCategory,
}) {
    const [typeFilter, setTypeFilter] = useState("all");
    const [search, setSearch] = useState("");
    const [expanded, setExpanded] = useState(false);
    const [toolsOpen, setToolsOpen] = useState(false);
    const searchRef = useRef(null);

    // มือถือ: ซ่อนตัวกรอง/ค้นหาไว้หลังปุ่ม ให้แถวรายการขึ้นมาก่อน
    useEffect(() => {
        if (toolsOpen) searchRef.current?.focus();
    }, [toolsOpen]);

    const keyword = search.trim().toLowerCase();
    const rows = transactions.filter((t) => {
        if (typeFilter !== "all" && t.type !== typeFilter) return false;
        if (categoryFilter && t.category !== categoryFilter) return false;
        if (!keyword) return true;
        const cat = getCategory(t.category);
        return (
            (t.note || "").toLowerCase().includes(keyword) ||
            cat.label.toLowerCase().includes(keyword) ||
            String(t.amount).includes(keyword)
        );
    });

    // จัดกลุ่มตามวัน (transactions เรียงใหม่สุดก่อนอยู่แล้ว)
    const groups = [];
    rows.forEach((t) => {
        const key = toInputDate(t.date);
        let g = groups[groups.length - 1];
        if (!g || g.key !== key) {
            g = { key, date: t.date, items: [], net: 0 };
            groups.push(g);
        }
        g.items.push(t);
        g.net += t.type === "income" ? t.amount : -t.amount;
    });

    const filtering = typeFilter !== "all" || keyword || categoryFilter;
    const showTools = !compact || toolsOpen || typeFilter !== "all" || search !== "";
    let visible = groups;
    if (compact && !expanded && !filtering) {
        visible = [];
        let count = 0;
        for (const g of groups) {
            if (count >= COMPACT_ROWS) break;
            visible.push(g);
            count += g.items.length;
        }
    }
    const hidden = rows.length - visible.reduce((n, g) => n + g.items.length, 0);

    const clearFilters = () => {
        setTypeFilter("all");
        setSearch("");
        onClearCategory?.();
    };

    return (
        <section className="panel" id="ledger" aria-labelledby="ledger-title">
            <div className="panel-head">
                <h2 className="panel-title" id="ledger-title">
                    รายการ<span className="count">{rows.length}</span>
                </h2>
                <div className="d-flex gap-2">
                    {compact && (
                        <button
                            type="button"
                            className={`btn btn-ghost btn-sm icon-btn ${showTools ? "active" : ""}`}
                            aria-expanded={showTools}
                            aria-controls="ledger-tools"
                            aria-label="ค้นหาและกรองรายการ"
                            title="ค้นหาและกรอง"
                            onClick={() => setToolsOpen((o) => !o)}
                        >
                            <Search size={16} aria-hidden="true" />
                        </button>
                    )}
                    <button
                        className="btn btn-ghost btn-sm"
                        disabled={rows.length === 0}
                        onClick={() => exportCsv(rows, `transactions-${month}.csv`)}
                    >
                        <Download size={16} aria-hidden="true" />
                        CSV
                    </button>
                </div>
            </div>

            <div className="ledger-tools" id="ledger-tools" hidden={!showTools}>
                <Segmented label="กรองประเภท" value={typeFilter} onChange={setTypeFilter} options={FILTERS} />
                <div className="field-search">
                    <Search size={16} aria-hidden="true" />
                    <input
                        ref={searchRef}
                        className="form-control"
                        type="search"
                        placeholder="ค้นหา หมวด บันทึก จำนวน"
                        aria-label="ค้นหารายการ"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                </div>
            </div>

            {categoryFilter && (
                <button
                    type="button"
                    className="filter-chip"
                    onClick={onClearCategory}
                    aria-label={`ล้างตัวกรองหมวด ${getCategory(categoryFilter).label}`}
                >
                    หมวด: {getCategory(categoryFilter).label}
                    <X size={15} aria-hidden="true" />
                </button>
            )}

            {loading && (
                <div aria-hidden="true">
                    {[70, 52, 64, 46].map((w, i) => (
                        <div key={i} className="row-item">
                            <span className="cat-tile" />
                            <span className="skeleton" style={{ width: `${w}%` }} />
                            <span className="skeleton" style={{ width: 56 }} />
                            <span />
                        </div>
                    ))}
                </div>
            )}

            {!loading && groups.length === 0 && (
                <div className="py-3">
                    {transactions.length === 0 ? (
                        <p className="empty">
                            <strong>ยังไม่มีรายการในเดือนนี้</strong>
                            <br />
                            เริ่มจากกด “จดรายการ” แล้วใส่จำนวนเงินกับหมวด รายการที่จดซ้ำบ่อยจะขึ้นเป็นปุ่มจดด่วนให้เอง
                        </p>
                    ) : (
                        <>
                            <p className="empty mb-2">ไม่พบรายการที่ตรงกับตัวกรอง</p>
                            <button type="button" className="btn btn-ghost btn-sm" onClick={clearFilters}>
                                ล้างตัวกรอง
                            </button>
                        </>
                    )}
                </div>
            )}

            {visible.map((g) => {
                const day = dayLabel(g.date);
                return (
                    <div key={g.key}>
                        <div className={`day-head ${day.today ? "is-today" : ""}`}>
                            <span>{day.text}</span>
                            <Money value={g.net} signed />
                        </div>

                        {g.items.map((t) => {
                            const cat = getCategory(t.category);
                            const isIncome = t.type === "income";
                            const title = t.note || cat.label;
                            // แตะทั้งแถวเพื่อแก้ไข (ปุ่มลบอยู่ในหน้าแก้ไข) -> ยอดเงินชิดขวาคอลัมน์เดียวกับยอดรวมวัน
                            return (
                                <button
                                    key={t.id}
                                    type="button"
                                    className={`row-item row-3 is-tappable ${editingId === t.id ? "is-editing" : ""}`}
                                    onClick={() => onEdit(t)}
                                    aria-label={`แก้ไขหรือลบ ${title} ${isIncome ? "+" : "−"}${formatMoney(t.amount)}`}
                                >
                                    <CategoryTile category={t.category} income={isIncome} />
                                    <span className="min-w-0">
                                        <span className="row-label d-block">
                                            {title}
                                            {t.recurringId && <Repeat size={13} aria-label="รายการประจำ" />}
                                        </span>
                                        {t.note && <span className="row-sub">{cat.label}</span>}
                                    </span>
                                    <Money
                                        value={isIncome ? t.amount : -t.amount}
                                        signed={isIncome}
                                        className={`row-amount ${isIncome ? "is-income" : ""}`}
                                    />
                                </button>
                            );
                        })}
                    </div>
                );
            })}

            {hidden > 0 && (
                <button type="button" className="btn btn-ghost ledger-more" onClick={() => setExpanded(true)}>
                    ดูอีก {hidden} รายการ
                </button>
            )}
        </section>
    );
}
