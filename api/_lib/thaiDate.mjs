// วันที่ตามเวลาไทย (UTC+7 ไม่มี daylight saving) — server ของ Vercel ใช้ UTC
// วันที่ส่งไปมาเป็น string "YYYY-MM-DD" เทียบมากน้อยด้วย < > ได้เลย
const OFFSET_MS = 7 * 60 * 60 * 1000;
const pad = (n) => String(n).padStart(2, "0");

export const TH_MONTHS_SHORT = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];

export const ymd = (y, m, d) => `${y}-${pad(m)}-${pad(d)}`;

export const bangkokYmd = (now) => new Date(now.getTime() + OFFSET_MS).toISOString().slice(0, 10);

export function addDays(date, days) {
    const d = new Date(`${date}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + days);
    return d.toISOString().slice(0, 10);
}

export function isValidYmd(y, m, d) {
    if (![y, m, d].every(Number.isInteger) || y < 1900 || y > 2100) return false;
    const dt = new Date(Date.UTC(y, m - 1, d));
    return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

// เก็บ date ของรายการเป็นเที่ยงวันเวลาไทย เหมือน fromInputDate ฝั่งเว็บ
export const noonBangkok = (date) => new Date(`${date}T12:00:00+07:00`);

export const monthKey = (date) => date.slice(0, 7);

export function monthBounds(date) {
    const [y, m] = date.split("-").map(Number);
    const [ny, nm] = m === 12 ? [y + 1, 1] : [y, m + 1];
    return {
        start: new Date(`${y}-${pad(m)}-01T00:00:00+07:00`),
        end: new Date(`${ny}-${pad(nm)}-01T00:00:00+07:00`),
    };
}

export const minuteIndex = (now) => Math.floor(now.getTime() / 60000);

export function thaiShortDate(date, withYear = false) {
    const [y, m, d] = date.split("-").map(Number);
    return `${d} ${TH_MONTHS_SHORT[m - 1]}${withYear ? ` ${y + 543}` : ""}`;
}

export function dateLabel(date, today) {
    if (date === today) return `วันนี้ (${thaiShortDate(date)})`;
    if (date === addDays(today, -1)) return `เมื่อวาน (${thaiShortDate(date)})`;
    return thaiShortDate(date, date.slice(0, 4) !== today.slice(0, 4));
}

export function monthLabel(date) {
    const [y, m] = date.split("-").map(Number);
    return `${TH_MONTHS_SHORT[m - 1]} ${y + 543}`;
}
