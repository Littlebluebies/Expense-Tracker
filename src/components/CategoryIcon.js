import {
    BookOpen,
    Briefcase,
    Bus,
    Clapperboard,
    Coins,
    Gift,
    House,
    Laptop,
    Package,
    Pill,
    ShoppingBag,
    Soup,
    Zap,
} from "lucide-react";

const ICONS = {
    food: Soup,
    travel: Bus,
    shopping: ShoppingBag,
    bills: Zap,
    housing: House,
    health: Pill,
    entertainment: Clapperboard,
    education: BookOpen,
    other: Package,
    salary: Briefcase,
    bonus: Gift,
    freelance: Laptop,
    income: Coins,
};

export default function CategoryIcon({ category, size = 18 }) {
    const Icon = ICONS[category] || Package;
    return <Icon size={size} strokeWidth={1.75} aria-hidden="true" />;
}

// ช่องไอคอนหน้ารายการ
export function CategoryTile({ category, income = false }) {
    return (
        <span className={`cat-tile ${income ? "is-income" : ""}`}>
            <CategoryIcon category={category} />
        </span>
    );
}
