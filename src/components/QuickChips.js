import { getCategory } from "../constants/categories";
import { formatMoney } from "../utils/format";
import CategoryIcon from "./CategoryIcon";
import Money from "./Money";

// ปุ่มลัดของรายการที่จดบ่อย: แตะครั้งเดียวลงรายการของวันนี้
export default function QuickChips({ items, onPick }) {
    return (
        <div className="quick-row" role="group" aria-label="จดด่วน (ลงเป็นรายการของวันนี้)">
            {items.map((item) => {
                const label = item.note || getCategory(item.category).label;
                const income = item.type === "income";
                return (
                    <button
                        key={item.key}
                        type="button"
                        className="quick-chip"
                        onClick={() => onPick(item)}
                        aria-label={`จดด่วน ${label} ${income ? "+" : ""}${formatMoney(item.amount)}`}
                    >
                        <CategoryIcon category={item.category} size={16} />
                        <span className="label">{label}</span>
                        <Money
                            value={item.amount}
                            signed={income}
                            className={income ? "is-income" : ""}
                        />
                    </button>
                );
            })}
        </div>
    );
}
