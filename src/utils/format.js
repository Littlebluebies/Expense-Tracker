const moneyFormatter = new Intl.NumberFormat("th-TH", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
});

export const formatNumber = (n) => moneyFormatter.format(n || 0);

export const formatMoney = (n) => `${formatNumber(n)} ฿`;

// Firestore Timestamp | Date | string -> Date
export const toDate = (value) => {
    if (!value) return new Date(0);
    if (typeof value.toDate === "function") return value.toDate();
    if (value.seconds !== undefined) return new Date(value.seconds * 1000);
    return new Date(value);
};

// "YYYY-MM" ของเวลาท้องถิ่น
export const monthKey = (date) =>
    `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;

export const parseMonthKey = (key) => {
    const [y, m] = key.split("-").map(Number);
    return new Date(y, m - 1, 1);
};

export const shiftMonth = (key, delta) => {
    const d = parseMonthKey(key);
    d.setMonth(d.getMonth() + delta);
    return monthKey(d);
};

export const monthLabel = (key, style = "long") =>
    parseMonthKey(key).toLocaleDateString("th-TH", {
        month: style,
        year: "numeric",
    });

export const daysInMonth = (key) => {
    const d = parseMonthKey(key);
    return new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
};

// "YYYY-MM-DD" สำหรับ <input type="date"> (เวลาท้องถิ่น)
export const toInputDate = (date) =>
    `${monthKey(date)}-${String(date.getDate()).padStart(2, "0")}`;

// "YYYY-MM-DD" -> Date เที่ยงวันเวลาท้องถิ่น (กันปัญหา timezone เลื่อนวัน)
export const fromInputDate = (str) => new Date(`${str}T12:00:00`);

// สถานะงบ: แสดงไอคอน + ข้อความคู่กับสีเสมอ (ไม่พึ่งสีอย่างเดียว) ดู components/StatusLabel.js
export const budgetStatus = (percent) => {
    if (percent > 100) return { tone: "over", text: "เกินงบแล้ว" };
    if (percent >= 80) return { tone: "near", text: "ใกล้เต็มงบ" };
    return { tone: "ok", text: "อยู่ในงบ" };
};
