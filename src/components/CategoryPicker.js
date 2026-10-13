import { useId } from "react";
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES } from "../constants/categories";
import CategoryIcon from "./CategoryIcon";

// เลือกหมวดด้วยการแตะ (radio) แทน dropdown -> แตะครั้งเดียวจบ
export default function CategoryPicker({ type, value, onChange }) {
    const name = useId();
    const categories = type === "income" ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
    return (
        <div
            className={`cat-picker ${type === "income" ? "is-income" : ""}`}
            role="radiogroup"
            aria-label="หมวดหมู่"
        >
            {categories.map((c) => (
                <span key={c.key} className="d-contents">
                    <input
                        type="radio"
                        id={`${name}-${c.key}`}
                        name={name}
                        value={c.key}
                        checked={value === c.key}
                        onChange={() => onChange(c.key)}
                    />
                    <label htmlFor={`${name}-${c.key}`}>
                        <CategoryIcon category={c.key} size={20} />
                        {c.label}
                    </label>
                </span>
            ))}
        </div>
    );
}
