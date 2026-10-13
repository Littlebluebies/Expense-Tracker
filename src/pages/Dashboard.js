import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ChevronLeft, ChevronRight, Mail, Moon, Plus, Settings, Sun, TriangleAlert, WifiOff } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { addTransaction, deleteTransaction } from "../firebase/transactions";
import { getCategory } from "../constants/categories";
import { useBudgets, useTransactions } from "../utils/useFinanceData";
import { useRecurring } from "../utils/useRecurring";
import { useTheme } from "../utils/theme";
import { useMediaQuery } from "../utils/useMediaQuery";
import { frequentItems } from "../utils/insights";
import { monthKey, monthLabel, shiftMonth } from "../utils/format";
import BudgetCard from "../components/BudgetCard";
import MonthCompareCard from "../components/MonthCompareCard";
import CategoryCard from "../components/CategoryCard";
import RecurringCard from "../components/RecurringCard";
import TransactionForm from "../components/TransactionForm";
import TransactionList from "../components/TransactionList";
import QuickChips from "../components/QuickChips";
import Sheet from "../components/Sheet";
import Money from "../components/Money";
import Guilloche, { RosetteMark } from "../components/Guilloche";
import { MonthlyChart } from "../components/Charts";

function useOnline() {
    const [online, setOnline] = useState(navigator.onLine);
    useEffect(() => {
        const update = () => setOnline(navigator.onLine);
        window.addEventListener("online", update);
        window.addEventListener("offline", update);
        return () => {
            window.removeEventListener("online", update);
            window.removeEventListener("offline", update);
        };
    }, []);
    return online;
}

export default function Dashboard() {
    const { user } = useAuth();
    const [theme, toggleTheme] = useTheme();
    const notify = useToast();

    const { transactions, loading, error } = useTransactions(user.uid);
    const { items: recurringItems } = useRecurring(user.uid, transactions, !loading, notify);
    const online = useOnline();
    const { budgets, budgetFor } = useBudgets(user.uid);

    return (
        <DashboardView
            user={user}
            theme={theme}
            toggleTheme={toggleTheme}
            notify={notify}
            transactions={transactions}
            loading={loading}
            error={error}
            recurringItems={recurringItems}
            online={online}
            budgets={budgets}
            budgetFor={budgetFor}
        />
    );
}

// หน้าจอล้วน (รับข้อมูลทาง props) แยกจากการโหลดข้อมูลด้านบน
export function DashboardView({
    user,
    theme,
    toggleTheme,
    notify,
    transactions,
    loading,
    error,
    recurringItems,
    online,
    budgets,
    budgetFor,
}) {
    const wide = useMediaQuery("(min-width: 992px)");
    const currentMonth = monthKey(new Date());
    const [month, setMonth] = useState(currentMonth);
    const [editing, setEditing] = useState(null);
    const [sheetOpen, setSheetOpen] = useState(false);
    const [categoryFilter, setCategoryFilter] = useState(null);

    const monthTx = useMemo(
        () => transactions.filter((t) => t.monthKey === month),
        [transactions, month]
    );

    const { income, expense, categoryTotals, topCategory } = useMemo(() => {
        let income = 0;
        let expense = 0;
        const categoryTotals = {};
        monthTx.forEach((t) => {
            if (t.type === "income") {
                income += t.amount;
            } else {
                expense += t.amount;
                categoryTotals[t.category] = (categoryTotals[t.category] || 0) + t.amount;
            }
        });
        const topCategory = Object.keys(categoryTotals).sort(
            (a, b) => categoryTotals[b] - categoryTotals[a]
        )[0];
        return { income, expense, categoryTotals, topCategory };
    }, [monthTx]);

    const quickItems = useMemo(() => frequentItems(transactions), [transactions]);

    const budget = budgetFor(month);
    const isCustomBudget = budgets.monthly[month] !== undefined && budgets.monthly[month] !== null;
    const balance = income - expense;

    // จด/แก้ไข ใช้ทางเดียวกันทุกขนาดจอ: แถบล่าง (มือถือ) หรือท้ายคอลัมน์ซ้าย (คอม) -> เปิด Sheet
    const openAdd = () => {
        setEditing(null);
        setSheetOpen(true);
    };

    const startEdit = (t) => {
        setEditing(t);
        setSheetOpen(true);
    };

    // ลบทันที แล้วกด "เลิกทำ" ใน toast ได้
    const removeEditing = (t) => {
        deleteTransaction(t, notify);
        setSheetOpen(false);
        setEditing(null);
    };

    // หลังบันทึก: ถ้ารายการอยู่คนละเดือน ให้สลับไปเดือนนั้น
    const handleFormDone = (savedDate) => {
        setEditing(null);
        setSheetOpen(false);
        if (savedDate) setMonth(monthKey(savedDate));
    };

    const closeSheet = () => {
        setSheetOpen(false);
        setEditing(null);
    };

    const changeMonth = (key) => {
        setEditing(null);
        setCategoryFilter(null);
        setMonth(key);
    };

    // จดด่วน: แตะครั้งเดียวลงรายการวันนี้เลย
    const quickAdd = (item) => {
        const label = item.note || getCategory(item.category).label;
        addTransaction(
            user.uid,
            {
                amount: item.amount,
                type: item.type,
                category: item.category,
                note: item.note,
                date: new Date(),
            },
            notify,
            `เพิ่ม "${label}" แล้ว`
        );
        handleFormDone(new Date());
    };

    const pickCategory = (key) => {
        const next = categoryFilter === key ? null : key;
        setCategoryFilter(next);
        if (next) document.getElementById("ledger")?.scrollIntoView({ behavior: "smooth", block: "start" });
    };

    return (
        <div className="dash">
            <div className="dash-side">
                <header className="band dash-band">
                    <Guilloche />
                    <div className="band-top">
                        <span className="wordmark">
                            <RosetteMark />
                            รายจ่าย
                        </span>
                        <div className="band-actions">
                            <button
                                className="btn band-ctl icon-btn"
                                onClick={toggleTheme}
                                aria-label={theme === "dark" ? "เปลี่ยนเป็นโหมดสว่าง" : "เปลี่ยนเป็นโหมดมืด"}
                                title={theme === "dark" ? "โหมดสว่าง" : "โหมดมืด"}
                            >
                                {theme === "dark" ? (
                                    <Sun size={18} aria-hidden="true" />
                                ) : (
                                    <Moon size={18} aria-hidden="true" />
                                )}
                            </button>
                            <Link
                                to="/settings"
                                className="btn band-ctl icon-btn"
                                aria-label={`ตั้งค่าบัญชี (${user.displayName || user.email})`}
                                title="ตั้งค่าบัญชี"
                            >
                                <Settings size={18} aria-hidden="true" />
                            </Link>
                        </div>
                    </div>

                    <nav className="month-nav" aria-label="เลือกเดือน">
                        <button
                            className="btn band-ctl icon-btn"
                            onClick={() => changeMonth(shiftMonth(month, -1))}
                            aria-label="เดือนก่อนหน้า"
                        >
                            <ChevronLeft size={20} aria-hidden="true" />
                        </button>
                        <div>
                            <h1>{monthLabel(month)}</h1>
                            {month !== currentMonth && (
                                <button className="btn btn-link" onClick={() => changeMonth(currentMonth)}>
                                    กลับไปเดือนปัจจุบัน
                                </button>
                            )}
                        </div>
                        <button
                            className="btn band-ctl icon-btn"
                            onClick={() => changeMonth(shiftMonth(month, 1))}
                            disabled={month >= currentMonth}
                            aria-label="เดือนถัดไป"
                        >
                            <ChevronRight size={20} aria-hidden="true" />
                        </button>
                    </nav>

                    <div className={`balance ${balance < 0 ? "is-negative" : ""}`}>
                        <span className="band-label">
                            {month === currentMonth ? "คงเหลือเดือนนี้" : `คงเหลือ ${monthLabel(month, "short")}`}
                        </span>
                        {loading ? (
                            <span className="money money-xl" aria-label="กำลังโหลด">
                                …
                            </span>
                        ) : (
                            <Money value={balance} size="xl" />
                        )}
                    </div>

                    <div className="flow">
                        <div>
                            <span className="band-label">รายรับ</span>
                            <Money value={income} signed size="md" />
                        </div>
                        <div>
                            <span className="band-label">รายจ่าย</span>
                            <Money value={-expense} size="md" />
                        </div>
                    </div>
                </header>

                {!online && (
                    <div className="notice is-warn" role="status">
                        <WifiOff size={16} aria-hidden="true" />
                        <span>ออฟไลน์อยู่ จดรายการได้ตามปกติ ข้อมูลจะซิงค์เมื่อกลับมาออนไลน์</span>
                    </div>
                )}

                {!user.emailVerified && (
                    <div className="notice">
                        <Mail size={16} aria-hidden="true" />
                        <span>
                            ยังไม่ได้ยืนยันอีเมล <Link to="/settings">ยืนยันที่หน้าตั้งค่า</Link> ช่วยให้กู้รหัสผ่านได้แน่นอน
                        </span>
                    </div>
                )}

                {error && (
                    <div className="notice is-danger" role="alert">
                        <TriangleAlert size={16} aria-hidden="true" />
                        <span>{error}</span>
                    </div>
                )}

                <BudgetCard
                    key={month}
                    uid={user.uid}
                    month={month}
                    budget={budget}
                    isCustom={isCustomBudget}
                    expense={expense}
                    topCategory={topCategory}
                    notify={notify}
                />

                <div className={`dock ${quickItems.length ? "" : "is-solo"}`}>
                    <div className="dock-inner">
                        {quickItems.length > 0 && <QuickChips items={quickItems} onPick={quickAdd} />}
                        <button className="btn btn-primary" onClick={openAdd}>
                            <Plus size={18} aria-hidden="true" />
                            จดรายการ
                        </button>
                    </div>
                </div>
            </div>

            <main className="dash-main">
                <TransactionList
                    key={month}
                    transactions={monthTx}
                    month={month}
                    loading={loading}
                    editingId={editing?.id}
                    onEdit={startEdit}
                    compact={!wide}
                    categoryFilter={categoryFilter}
                    onClearCategory={() => setCategoryFilter(null)}
                />
            </main>

            <aside className="dash-aside" aria-label="สรุปเดือน">
                <MonthCompareCard transactions={transactions} month={month} />

                <CategoryCard
                    uid={user.uid}
                    limits={budgets.categories}
                    spent={categoryTotals}
                    monthBudget={budget}
                    notify={notify}
                    activeKey={categoryFilter}
                    onPick={pickCategory}
                />

                <MonthlyChart
                    transactions={transactions}
                    month={month}
                    budgetFor={budgetFor}
                    mode={theme}
                    onSelectMonth={changeMonth}
                />

                <RecurringCard uid={user.uid} items={recurringItems} notify={notify} />
            </aside>

            <Sheet open={sheetOpen} onClose={closeSheet} title={editing ? "แก้ไขรายการ" : "จดรายการ"}>
                <TransactionForm
                    uid={user.uid}
                    editing={editing}
                    onDone={handleFormDone}
                    onCancel={closeSheet}
                    onDelete={removeEditing}
                    notify={notify}
                />
            </Sheet>
        </div>
    );
}
