import { GLOBAL_WORDS } from "./dictionary.mjs";
import { typeOf } from "./categories.mjs";
import { addDays, isValidYmd, ymd } from "./thaiDate.mjs";

export const MAX_ITEMS = 10;
export const MAX_AMOUNT = 1_000_000_000;
export const MAX_NOTE = 100;
export const LEARN_KEY_MAX = 30;

const THAI_DIGITS = "๐๑๒๓๔๕๖๗๘๙";

// เลขไทย -> อารบิก, ตัดจุลภาคหลักพัน, ช่องว่าง/ขึ้นบรรทัดหลายตัว -> ช่องว่างเดียว
export const normalize = (text) =>
    String(text || "")
        .replace(/[๐-๙]/g, (c) => String(THAI_DIGITS.indexOf(c)))
        .replace(/(\d),(?=\d{3}(?!\d))/g, "$1")
        .replace(/\s+/g, " ")
        .trim();

// ---------- วันที่ (ดูเฉพาะต้นข้อความ) ----------

const RELATIVE = [["เมื่อวานซืน", -2], ["เมื่อวาน", -1], ["วันนี้", 0]];
const MONTH_NAMES = [
    ["มกราคม", "ม.ค.", "มค"], ["กุมภาพันธ์", "ก.พ.", "กพ"], ["มีนาคม", "มี.ค.", "มีค"],
    ["เมษายน", "เม.ย.", "เมย"], ["พฤษภาคม", "พ.ค.", "พค"], ["มิถุนายน", "มิ.ย.", "มิย"],
    ["กรกฎาคม", "ก.ค.", "กค"], ["สิงหาคม", "ส.ค.", "สค"], ["กันยายน", "ก.ย.", "กย"],
    ["ตุลาคม", "ต.ค.", "ตค"], ["พฤศจิกายน", "พ.ย.", "พย"], ["ธันวาคม", "ธ.ค.", "ธค"],
];
const MONTH_VARIANTS = MONTH_NAMES.flatMap((names, i) => names.map((name) => ({ name, month: i + 1 }))).sort(
    (a, b) => b.name.length - a.name.length
);

function resolveDate(d, m, y, today, rest) {
    const thisYear = Number(today.slice(0, 4));
    let year = y === null ? thisYear : y > 2400 ? y - 543 : y; // ปีเกิน 2400 = พ.ศ.
    if (!isValidYmd(year, m, d)) return { error: "invalid_date" };
    let date = ymd(year, m, d);
    // ไม่ระบุปีแล้ววันนั้นยังมาไม่ถึง -> หมายถึงปีที่แล้ว
    if (y === null && date > today) {
        year -= 1;
        if (!isValidYmd(year, m, d)) return { error: "invalid_date" };
        date = ymd(year, m, d);
    }
    if (date > today) return { error: "future_date" };
    return { date, rest };
}

function leadingDate(s, today) {
    for (const [word, offset] of RELATIVE) {
        if (s.startsWith(word)) return { date: addDays(today, offset), rest: s.slice(word.length) };
    }
    const slash = s.match(/^(\d{1,2})\/(\d{1,2})(?:\/(\d{4}))?(?![\d/])/);
    if (slash) return resolveDate(+slash[1], +slash[2], slash[3] ? +slash[3] : null, today, s.slice(slash[0].length));

    const day = s.match(/^(\d{1,2}) ?/);
    if (!day) return null;
    const after = s.slice(day[0].length);
    for (const { name, month } of MONTH_VARIANTS) {
        if (!after.startsWith(name)) continue;
        let rest = after.slice(name.length);
        // ชื่อเดือนแบบไม่มีจุดต้องจบคำ ("มีค" ไม่ใช่ต้นของ "มีค่า...")
        if (!name.endsWith(".") && rest && !/^[\s\d]/.test(rest)) continue;
        const year = rest.match(/^ ?(\d{4})(?!\d)/);
        if (year) rest = rest.slice(year[0].length);
        return resolveDate(+day[1], month, year ? +year[1] : null, today, rest);
    }
    return null;
}

// ---------- จำนวนเงิน ----------

const CLASSIFIERS = [
    "จาน", "แก้ว", "ชิ้น", "ขวด", "ห่อ", "กล่อง", "คน", "ลิตร", "อัน", "ใบ", "ตัว", "เล่ม",
    "ถุง", "ชาม", "ลูก", "กิโล", "แพ็ค", "คู่", "วัน", "เดือน", "ปี",
];
const CURRENCY = /^ ?(?:บาท|บ\.|\.-|บ(?![฀-๿]))/;
const THOUSAND = /^ ?[kK](?![A-Za-z])/;

// ลักษณนามต้องตามด้วยช่องว่าง/ตัวเลข/วรรคตอน/จบข้อความ ("50 คนละครึ่ง" ไม่ใช่ลักษณนาม)
const startsWithClassifier = (rest) => {
    const r = rest.replace(/^ /, "");
    return CLASSIFIERS.some((c) => r.startsWith(c) && /^(?:$|[\s\d,.;:!?)\]])/.test(r.slice(c.length)));
};

function scanAmounts(s) {
    const tokens = [];
    for (const m of s.matchAll(/\d+(?:\.\d+)?/g)) {
        let start = m.index;
        let end = start + m[0].length;
        const before = s[start - 1] || "";
        // ติดตัวอักษร/ตัวเลข/จุด/เวลา/วันที่ข้างหน้า (A4, 12:30, 12/10) หรือเป็นท้ายของ 7-11
        if (/[A-Za-z0-9.:/]/.test(before)) continue;
        if (before === "-" && /\d/.test(s[start - 2] || "")) continue;
        let rest = s.slice(end);
        if (/^[:/-]\d/.test(rest)) continue;

        let value = Number(m[0]);
        let unit = false;
        const k = rest.match(THOUSAND);
        if (k) {
            value *= 1000;
            end += k[0].length;
            rest = s.slice(end);
            unit = true;
        }
        const cur = rest.match(CURRENCY);
        if (cur) {
            end += cur[0].length;
            unit = true;
        }
        if (!unit && (/^[A-Za-z]/.test(rest) || startsWithClassifier(rest))) continue; // 5G, 2 จาน

        let plus = false;
        if (s[start - 1] === "฿") start -= 1;
        if (s[start - 1] === "+") {
            plus = true;
            start -= 1;
        }
        value = Math.round(value * 100) / 100;
        if (value <= 0) continue;
        tokens.push({ start, end, value, plus });
    }
    return tokens;
}

// ---------- หมวด ----------

const SEPARATORS = /^(?:[\s,/+\-:;]|และ)+|(?:[\s,/+\-:;]|และ)+$/g;
const clean = (text) => text.replace(SEPARATORS, "").slice(0, MAX_NOTE);
const INCOME_PREFIX = /^(?:ได้|รับ)/;

export const learnKey = (note) => note.toLowerCase().replace(/\s+/g, "").slice(0, LEARN_KEY_MAX);

function longestMatch(words, key) {
    let best = null;
    let bestLength = 0;
    for (const [word, category] of Object.entries(words)) {
        if (word && word.length > bestLength && key.includes(word)) {
            best = category;
            bestLength = word.length;
        }
    }
    return best;
}

export function matchCategory(note, personal = {}) {
    const key = note.toLowerCase().replace(/\s+/g, "");
    if (!key) return { category: null, source: null };
    const mine = longestMatch(personal, key);
    if (mine) return { category: mine, source: "personal" };
    const global = longestMatch(GLOBAL_WORDS, key);
    if (global) return { category: global, source: "global" };
    return { category: null, source: null };
}

function buildItem(note, token, personal) {
    const { category: found, source } = matchCategory(note, personal);
    let category = found;
    let type = category ? typeOf(category) : "expense";
    // หมวดที่ผู้ใช้สอนเองชนะคำนำหน้า ได้/รับ แต่เครื่องหมาย + ชนะทุกอย่าง
    if (token.plus || (source !== "personal" && INCOME_PREFIX.test(note))) {
        type = "income";
        if (category && typeOf(category) === "expense") category = "income";
    }
    return { note, amount: token.value, type, category };
}

// ---------- รวม ----------

export function parseMessage(text, { personal = {}, today }) {
    const s = normalize(text);
    const lead = leadingDate(s, today);
    if (lead?.error) return { date: null, items: [], ignored: null, error: lead.error };
    const date = lead ? lead.date : null;
    const rest = lead ? lead.rest.trim() : s;

    const tokens = scanAmounts(rest);
    if (tokens.length === 0) return { date, items: [], ignored: null, error: null };
    if (tokens.length > MAX_ITEMS) return { date, items: [], ignored: null, error: "too_many_items" };
    if (tokens.some((t) => t.value > MAX_AMOUNT)) return { date, items: [], ignored: null, error: "amount_too_large" };

    // "50 ค่าข้าว 100 ค่าน้ำ" (ตัวเลขขึ้นก่อน) -> คำอธิบายอยู่หลังตัวเลข
    const amountFirst = clean(rest.slice(0, tokens[0].start)) === "";
    const items = tokens.map((t, k) => {
        const from = amountFirst ? t.end : k === 0 ? 0 : tokens[k - 1].end;
        const to = amountFirst ? (tokens[k + 1]?.start ?? rest.length) : t.start;
        return buildItem(clean(rest.slice(from, to)), t, personal);
    });
    const tail = amountFirst ? "" : clean(rest.slice(tokens[tokens.length - 1].end));
    return { date, items, ignored: tail || null, error: null };
}
