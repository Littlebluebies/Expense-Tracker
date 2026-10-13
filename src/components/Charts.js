import { Bar } from "react-chartjs-2";
import {
    Chart as ChartJS,
    BarController,
    BarElement,
    CategoryScale,
    LinearScale,
    LineController,
    LineElement,
    PointElement,
    Tooltip,
} from "chart.js";
import { formatMoney, monthLabel, parseMonthKey, shiftMonth } from "../utils/format";

ChartJS.register(
    BarController,
    BarElement,
    CategoryScale,
    LinearScale,
    LineController,
    LineElement,
    PointElement,
    Tooltip
);
ChartJS.defaults.font.family = "Anuphan, 'Noto Sans Thai', sans-serif";

// เดือนที่เลือกพิมพ์หมึกเต็ม เดือนอื่นถอยเป็นสีจาง เดือนที่เกินงบใช้หมึกแดง
const THEME = {
    light: {
        bar: "#1f5e3d",
        barTint: "rgba(31, 94, 61, 0.28)",
        over: "#b2303a",
        overTint: "rgba(178, 48, 58, 0.32)",
        line: "#535b4f",
        grid: "#d3d8cc",
        text: "#535b4f",
        tooltip: "#1c211b",
    },
    dark: {
        bar: "#5fb886",
        barTint: "rgba(95, 184, 134, 0.3)",
        over: "#f07d84",
        overTint: "rgba(240, 125, 132, 0.32)",
        line: "#a3ae9f",
        grid: "#26302a",
        text: "#a3ae9f",
        tooltip: "#e4e9e1",
    },
};

// รายจ่ายรายเดือน (ย้อนหลัง 6 เดือนจนถึงเดือนที่เลือก) เทียบกับงบของแต่ละเดือน
export function MonthlyChart({ transactions, month, budgetFor, mode, onSelectMonth }) {
    const t = THEME[mode];
    const months = Array.from({ length: 6 }, (_, i) => shiftMonth(month, i - 5));

    const expenseByMonth = Object.fromEntries(months.map((m) => [m, 0]));
    transactions.forEach((tx) => {
        if (tx.type === "expense" && tx.monthKey in expenseByMonth) {
            expenseByMonth[tx.monthKey] += tx.amount;
        }
    });

    const expenses = months.map((m) => expenseByMonth[m]);
    const budgets = months.map((m) => budgetFor(m) || null);
    const hasBudget = budgets.some((b) => b);
    const over = months.map((m, i) => budgets[i] && expenses[i] > budgets[i]);

    const data = {
        labels: months.map((m) => parseMonthKey(m).toLocaleDateString("th-TH", { month: "short" })),
        datasets: [
            {
                type: "bar",
                label: "รายจ่าย",
                data: expenses,
                backgroundColor: months.map((m, i) => {
                    const selected = m === month;
                    if (over[i]) return selected ? t.over : t.overTint;
                    return selected ? t.bar : t.barTint;
                }),
                borderRadius: 3,
                maxBarThickness: 34,
                order: 2,
            },
            ...(hasBudget
                ? [
                      {
                          type: "line",
                          label: "งบประมาณ",
                          data: budgets,
                          borderColor: t.line,
                          backgroundColor: t.line,
                          borderWidth: 1.5,
                          borderDash: [5, 4],
                          pointRadius: 0,
                          pointHoverRadius: 3,
                          stepped: "middle",
                          spanGaps: true,
                          order: 1,
                      },
                  ]
                : []),
        ],
    };

    const summary = months
        .map((m, i) => `${monthLabel(m, "short")} ${formatMoney(expenses[i])}${over[i] ? " (เกินงบ)" : ""}`)
        .join(", ");

    return (
        <section className="panel" aria-labelledby="monthly-title">
            <div className="panel-head mb-1">
                <h2 className="panel-title" id="monthly-title">
                    รายจ่ายรายเดือน
                </h2>
                <span className="panel-meta">6 เดือน</span>
            </div>
            <div style={{ height: 210 }} role="img" aria-label={`รายจ่าย 6 เดือน: ${summary}`}>
                <Bar
                    data={data}
                    options={{
                        responsive: true,
                        maintainAspectRatio: false,
                        interaction: { mode: "index", intersect: false },
                        onClick: (_, elements) => {
                            if (elements.length) onSelectMonth(months[elements[0].index]);
                        },
                        onHover: (e, elements) => {
                            if (e.native?.target) e.native.target.style.cursor = elements.length ? "pointer" : "default";
                        },
                        plugins: {
                            legend: { display: false },
                            tooltip: {
                                backgroundColor: t.tooltip,
                                titleColor: mode === "dark" ? "#1c211b" : "#f1f5ef",
                                bodyColor: mode === "dark" ? "#1c211b" : "#f1f5ef",
                                footerColor: mode === "dark" ? "#1c211b" : "#f1f5ef",
                                padding: 10,
                                cornerRadius: 8,
                                displayColors: false,
                                callbacks: {
                                    title: (items) => monthLabel(months[items[0].dataIndex]),
                                    label: (ctx) => `${ctx.dataset.label}: ${formatMoney(ctx.parsed.y)}`,
                                    footer: (items) => {
                                        const i = items[0].dataIndex;
                                        const b = budgets[i];
                                        if (!b) return "";
                                        const diff = b - expenses[i];
                                        return diff >= 0 ? `คงเหลือ ${formatMoney(diff)}` : `เกินงบ ${formatMoney(-diff)}`;
                                    },
                                },
                            },
                        },
                        scales: {
                            x: {
                                grid: { display: false },
                                border: { color: t.grid },
                                ticks: { color: t.text, font: { size: 12 } },
                            },
                            y: {
                                beginAtZero: true,
                                grid: { color: t.grid },
                                border: { display: false },
                                ticks: {
                                    color: t.text,
                                    font: { size: 11 },
                                    maxTicksLimit: 5,
                                    callback: (v) => Number(v).toLocaleString("th-TH"),
                                },
                            },
                        },
                    }}
                />
            </div>
            <div className="chart-legend" aria-hidden="true">
                <span>
                    <i />
                    รายจ่าย
                </span>
                {hasBudget && (
                    <span>
                        <i className="is-line" />
                        งบ
                    </span>
                )}
                {over.some(Boolean) && (
                    <span>
                        <i className="is-over" />
                        เกินงบ
                    </span>
                )}
            </div>
            <p className="form-hint">แตะแท่งกราฟเพื่อไปดูเดือนนั้น</p>
        </section>
    );
}
