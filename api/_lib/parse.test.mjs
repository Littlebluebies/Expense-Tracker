import { test } from "node:test";
import assert from "node:assert/strict";
import { learnKey, matchCategory, parseMessage } from "./parse.mjs";

const TODAY = "2026-10-14";
const parse = (text, personal = {}) => parseMessage(text, { personal, today: TODAY });
const rows = (text, personal) => parse(text, personal).items.map((it) => [it.note, it.amount, it.type, it.category]);

test("the spec example becomes three categorized expenses", () => {
    assert.deepEqual(rows("ค่าข้าวตอนกลางวัน 50 บาท ค่าน้ำ 100 บาท ค่าเน็ต 20 บาท"), [
        ["ค่าข้าวตอนกลางวัน", 50, "expense", "food"],
        ["ค่าน้ำ", 100, "expense", "bills"],
        ["ค่าเน็ต", 20, "expense", "bills"],
    ]);
    assert.equal(parse("ค่าข้าว 50").date, null);
});

const AMOUNTS = [
    ["ค่าข้าว 50", "ค่าข้าว", 50],
    ["ค่าข้าว50", "ค่าข้าว", 50],
    ["ค่าข้าว 50บ.", "ค่าข้าว", 50],
    ["ค่าข้าว 50 บ", "ค่าข้าว", 50],
    ["ค่าข้าว 50.-", "ค่าข้าว", 50],
    ["ค่าข้าว ฿50", "ค่าข้าว", 50],
    ["ค่าข้าว ๕๐ บาท", "ค่าข้าว", 50],
    ["ค่าข้าว 45.50", "ค่าข้าว", 45.5],
    ["ค่ากาแฟ 45.999", "ค่ากาแฟ", 46],
    ["ค่าเช่า 1.5k", "ค่าเช่า", 1500],
    ["เงินเดือน 25,000", "เงินเดือน", 25000],
    ["เงินเดือน 1,234,567.50", "เงินเดือน", 1234567.5],
    ["ค่าข้าว -50", "ค่าข้าว", 50],
    ["ข้าว 2 จาน 100", "ข้าว 2 จาน", 100],
    ["ซิม 5G 300", "ซิม 5G", 300],
    ["7-11 85", "7-11", 85],
    ["ประชุม 12:30 ค่ากาแฟ 60", "ประชุม 12:30 ค่ากาแฟ", 60],
];
for (const [text, note, amount] of AMOUNTS) {
    test(`amount: ${text}`, () => {
        const { items } = parse(text);
        assert.equal(items.length, 1);
        assert.equal(items[0].note, note);
        assert.equal(items[0].amount, amount);
    });
}

const CATEGORY_CASES = [
    ["ค่าน้ำมัน 500", "travel"],
    ["เติมน้ำมัน 500", "travel"],
    ["น้ำเปล่า 10", "food"],
    ["ซื้อน้ำ 20", "food"],
    ["ค่าน้ำ 100", "bills"],
    ["ค่าไฟฟ้า 900", "bills"],
    ["รถไฟฟ้า 42", "travel"],
    ["หนังสือ 300", "education"],
    ["ดูหนัง 220", "entertainment"],
    ["grab 120", "travel"],
    ["Grab Food 150", "food"],
    ["ค่าเช่ารถ 800", "travel"],
    ["ค่าเช่า 4500", "housing"],
    ["อาหารเสริม 500", "health"],
    ["ยาสีฟัน 45", "shopping"],
    ["ค่ายา 120", "health"],
    ["Netflix 419", "entertainment"],
    ["ค่าเทอม 15000", "education"],
    ["ทำบุญ 100", "other"],
    ["7-11 85", "food"],
];
for (const [text, category] of CATEGORY_CASES) {
    test(`category: ${text} → ${category}`, () => {
        assert.equal(parse(text).items[0].category, category);
    });
}

test("income is detected from the category, a ได้/รับ prefix or a + sign", () => {
    assert.deepEqual(rows("เงินเดือน 25000"), [["เงินเดือน", 25000, "income", "salary"]]);
    assert.deepEqual(rows("โบนัส 10000"), [["โบนัส", 10000, "income", "bonus"]]);
    assert.deepEqual(rows("ได้ค่าจ้าง 3000"), [["ได้ค่าจ้าง", 3000, "income", "freelance"]]);
    assert.deepEqual(rows("รับเงินคืน 200"), [["รับเงินคืน", 200, "income", "income"]]);
    assert.deepEqual(rows("+500 ขายของ"), [["ขายของ", 500, "income", "income"]]);
    assert.deepEqual(rows("เพื่อนคืนค่าข้าว +50"), [["เพื่อนคืนค่าข้าว", 50, "income", "income"]]);
    assert.deepEqual(rows("รับส่งลูก 1500"), [["รับส่งลูก", 1500, "income", null]]);
});

test("the personal dictionary wins over the global one and its type over the prefix", () => {
    assert.deepEqual(rows("ค่าแมว 300"), [["ค่าแมว", 300, "expense", null]]);
    assert.deepEqual(rows("ค่าแมว 300", { "ค่าแมว": "other" }), [["ค่าแมว", 300, "expense", "other"]]);
    assert.deepEqual(rows("จ่ายค่าแมวเดือนนี้ 300", { "ค่าแมว": "other" }), [["จ่ายค่าแมวเดือนนี้", 300, "expense", "other"]]);
    assert.deepEqual(rows("ค่าน้ำ 15", { "ค่าน้ำ": "food" }), [["ค่าน้ำ", 15, "expense", "food"]]);
    assert.deepEqual(rows("รับส่งลูก 1500", { "รับส่งลูก": "travel" }), [["รับส่งลูก", 1500, "expense", "travel"]]);
});

const DATES = [
    ["วันนี้ ค่าข้าว 50", "2026-10-14"],
    ["เมื่อวาน ค่าข้าว 50", "2026-10-13"],
    ["เมื่อวานซืน ค่าข้าว 50", "2026-10-12"],
    ["12/10 ค่าแท็กซี่ 120", "2026-10-12"],
    ["12/10/2569 ค่าข้าว 50", "2026-10-12"],
    ["12/10/2026 ค่าข้าว 50", "2026-10-12"],
    ["12 ต.ค. ค่าข้าว 50", "2026-10-12"],
    ["12 ตค ค่าข้าว 50", "2026-10-12"],
    ["12 ตุลาคม 2569 ค่าข้าว 50", "2026-10-12"],
    ["1 มีนาคม ค่าข้าว 50", "2026-03-01"],
    ["20/12 ค่าข้าว 50", "2025-12-20"],
    ["15/10 ค่าข้าว 50", "2025-10-15"],
    ["29/2/2567 ค่าข้าว 50", "2024-02-29"],
];
for (const [text, date] of DATES) {
    test(`date: ${text} → ${date}`, () => {
        const result = parse(text);
        assert.equal(result.error, null);
        assert.equal(result.date, date);
        assert.equal(result.items.length, 1);
    });
}

test("the text after a date becomes the note", () => {
    assert.deepEqual(rows("12/10 ค่าแท็กซี่ 120"), [["ค่าแท็กซี่", 120, "expense", "travel"]]);
});

test("bad dates are errors", () => {
    assert.equal(parse("15/10/2026 ค่าข้าว 50").error, "future_date");
    assert.equal(parse("31/9 ค่าข้าว 50").error, "invalid_date");
    assert.equal(parse("29/2/2026 ค่าข้าว 50").error, "invalid_date");
});

test("a word that only starts like a month is not a date", () => {
    assert.equal(parse("5 มีค่าใช้จ่าย 100").date, null);
});

test("item count and amount limits", () => {
    const many = (n) => Array.from({ length: n }, (_, i) => `ข้าว ${i + 1}`).join(" ");
    assert.equal(parse(many(10)).items.length, 10);
    assert.equal(parse(many(11)).error, "too_many_items");
    assert.equal(parse("บ้าน 1000000000").items[0].amount, 1_000_000_000);
    assert.equal(parse("บ้าน 2000000000").error, "amount_too_large");
});

test("no amount means no items; a date alone keeps the date", () => {
    assert.deepEqual(parse("สวัสดี"), { date: null, items: [], ignored: null, error: null });
    assert.deepEqual(parse("เมื่อวาน"), { date: "2026-10-13", items: [], ignored: null, error: null });
});

test("trailing text without an amount is reported as ignored", () => {
    const r = parse("ค่าข้าว 50 ค่าน้ำ");
    assert.deepEqual(r.items.map((it) => it.note), ["ค่าข้าว"]);
    assert.equal(r.ignored, "ค่าน้ำ");
    const r2 = parse("ค่าข้าว 50 คนละครึ่ง");
    assert.equal(r2.items[0].amount, 50);
    assert.equal(r2.ignored, "คนละครึ่ง");
});

test("amount-first messages use the text after each amount", () => {
    assert.deepEqual(rows("50 ค่าข้าว 100 ค่าน้ำ"), [
        ["ค่าข้าว", 50, "expense", "food"],
        ["ค่าน้ำ", 100, "expense", "bills"],
    ]);
});

test("separators, newlines and extra spaces are cleaned from notes", () => {
    const notes = (t) => parse(t).items.map((it) => it.note);
    assert.deepEqual(notes("ค่าข้าว 50\n\nค่าน้ำ   100"), ["ค่าข้าว", "ค่าน้ำ"]);
    assert.deepEqual(notes("ค่าข้าว 50, ค่าน้ำ 100"), ["ค่าข้าว", "ค่าน้ำ"]);
    assert.deepEqual(notes("ค่าข้าว 50 และ ค่าน้ำ 100"), ["ค่าข้าว", "ค่าน้ำ"]);
});

test("a bare amount has an empty note and no category; long notes are cut to 100", () => {
    assert.deepEqual(rows("50"), [["", 50, "expense", null]]);
    assert.equal(parse(`${"ก".repeat(150)} 50`).items[0].note.length, 100);
});

test("learnKey and matchCategory", () => {
    assert.equal(learnKey(" ค่า แมว "), "ค่าแมว");
    assert.equal(learnKey("ABC"), "abc");
    assert.equal(learnKey("ก".repeat(40)).length, 30);
    assert.deepEqual(matchCategory(""), { category: null, source: null });
    assert.deepEqual(matchCategory("ค่าน้ำ"), { category: "bills", source: "global" });
    assert.deepEqual(matchCategory("ค่าน้ำ", { "ค่าน้ำ": "food" }), { category: "food", source: "personal" });
});
