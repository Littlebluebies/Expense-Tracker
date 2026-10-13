import { ArrowDown, ArrowUp } from "lucide-react";
import { getCategory } from "../constants/categories";
import { compareWithPreviousMonth, percentChange } from "../utils/insights";
import { formatMoney, monthLabel, shiftMonth } from "../utils/format";
import { CategoryTile } from "./CategoryIcon";

// ใช้มากขึ้น (แย่) / ใช้น้อยลง (ดี) — มีลูกศร + ข้อความ ไม่พึ่งสีอย่างเดียว
function Change({ diff, current, previous }) {
    const pct = percentChange(current, previous);
    const up = diff > 0;
    const Arrow = up ? ArrowUp : ArrowDown;
    return (
        <span className={`d-inline-flex align-items-center gap-1 text-nowrap fw-semibold ${up ? "is-danger" : "is-ok"}`}>
            <Arrow size={14} strokeWidth={2.25} aria-label={up ? "เพิ่มขึ้น" : "ลดลง"} />
            <span className="money">{formatMoney(Math.abs(diff))}</span>
            {pct !== null && <span className="fw-normal">({up ? "+" : "−"}{Math.abs(pct)}%)</span>}
        </span>
    );
}

export default function MonthCompareCard({ transactions, month }) {
    const r = compareWithPreviousMonth(transactions, month);
    if (r.current === 0 && r.previous === 0) return null;

    const prevLabel = monthLabel(shiftMonth(month, -1), "short");
    const period = r.partial ? `ช่วงวันที่ 1–${r.cutoff} ของ ${prevLabel}` : prevLabel;

    let headline;
    if (r.previous === 0) {
        headline = <>{prevLabel} ไม่มีรายจ่ายในช่วงเดียวกัน</>;
    } else if (Math.abs(r.diff) < 0.01) {
        headline = <>รายจ่ายเท่ากับ{period}</>;
    } else {
        headline = (
            <>
                รายจ่าย{r.diff > 0 ? "มากกว่า" : "น้อยกว่า"}
                {period} <Change diff={r.diff} current={r.current} previous={r.previous} />
            </>
        );
    }

    return (
        <section className="panel" aria-labelledby="compare-title">
            <div className="panel-head mb-1">
                <h2 className="panel-title" id="compare-title">
                    เทียบกับเดือนก่อน
                </h2>
            </div>
            <p className="mb-2">{headline}</p>
            {r.previous > 0 &&
                r.changes.slice(0, 3).map((c) => {
                    const cat = getCategory(c.key);
                    return (
                        <div key={c.key} className="row-item row-3">
                            <CategoryTile category={c.key} />
                            <span className="row-label">{cat.label}</span>
                            <Change diff={c.diff} current={c.current} previous={c.previous} />
                        </div>
                    );
                })}
        </section>
    );
}
