import { test } from "node:test";
import assert from "node:assert/strict";
import { handleEvent } from "./bot.mjs";
import { encodePostback } from "./postback.mjs";
import { createFakeStore } from "./testing/fakes.mjs";

const NOW = new Date("2026-10-14T05:00:00Z");
const LIMITS = { perMinute: 20, perDay: 300 };
const LINKS = { U1: { userId: "u1", displayName: "Ann" }, U2: { userId: "u2", displayName: "Bob" } };
const store0 = (extra = {}) => createFakeStore({ links: LINKS, ...extra });
const text = (t, id = "m1") => ({ type: "message", replyToken: "rt", source: { type: "user", userId: "U1" }, message: { type: "text", id, text: t } });
const tap = (data, params, userId = "U1") => ({
    type: "postback",
    replyToken: "rt",
    source: { type: "user", userId },
    postback: { data: encodePostback(data), ...(params ? { params } : {}) },
});
const run = (store, event, now = NOW) => handleEvent(event, { store, now, limits: LIMITS, webUrl: "https://app.test" });
const texts = (msgs) => msgs.map((m) => m.text);
const str = (m) => JSON.stringify(m);

async function awaiting(store, message = "ค่าข้าว 50 ค่าแมว 300", id = "m1") {
    await run(store, text(message, id));
    return id;
}
async function opened(store, message, id) {
    const d = await awaiting(store, message, id);
    await run(store, tap({ a: "date", d, v: "today" }));
    return d;
}

test("today saves known items at noon and asks about the unknown one", async () => {
    const store = store0();
    const d = await awaiting(store);
    const msgs = await run(store, tap({ a: "date", d, v: "today" }));
    assert.equal(store.txs.size, 1);
    assert.equal([...store.txs.values()][0].date.toISOString(), "2026-10-14T05:00:00.000Z");
    assert.match(str(msgs[0]), /บันทึกแล้ว 1 รายการ · วันนี้ \(14 ต\.ค\.\)/);
    assert.equal(msgs[1].text, "เลือกหมวดของ “ค่าแมว 300 บาท”");
    assert.equal(store.drafts.get(d).status, "open");
});

test("yesterday and the date picker set the date", async () => {
    const a = store0();
    await run(a, tap({ a: "date", d: await awaiting(a, "ค่าข้าว 50"), v: "yesterday" }));
    assert.equal([...a.txs.values()][0].date.toISOString(), "2026-10-13T05:00:00.000Z");
    const b = store0();
    await run(b, tap({ a: "date", d: await awaiting(b, "ค่าข้าว 50"), v: "pick" }, { date: "2026-10-01" }));
    assert.equal([...b.txs.values()][0].date.toISOString(), "2026-10-01T05:00:00.000Z");
});

test("a future or malformed picked date is refused without saving", async () => {
    for (const params of [{ date: "2026-10-15" }, { date: "14/10/2026" }, { date: "2026-02-30" }, { date: "2026-13-01" }, undefined]) {
        const store = store0();
        const d = await awaiting(store, "ค่าข้าว 50");
        assert.deepEqual(texts(await run(store, tap({ a: "date", d, v: "pick" }, params))), ["เลือกวันที่ไม่เกินวันนี้"]);
        assert.equal(store.txs.size, 0);
        assert.equal(store.drafts.get(d).status, "awaitingDate");
    }
});

test("tapping a date twice saves once", async () => {
    const store = store0();
    const d = await awaiting(store, "ค่าข้าว 50");
    await run(store, tap({ a: "date", d, v: "today" }));
    assert.deepEqual(texts(await run(store, tap({ a: "date", d, v: "yesterday" }))), ["บันทึกไปแล้ว"]);
    assert.equal(store.txs.size, 1);
});

test("cancel discards the draft and later taps say so", async () => {
    const store = store0();
    const d = await awaiting(store, "ค่าข้าว 50");
    assert.deepEqual(texts(await run(store, tap({ a: "cancel", d }))), ["ยกเลิกแล้ว ไม่ได้บันทึกรายการ"]);
    assert.deepEqual(texts(await run(store, tap({ a: "date", d, v: "today" }))), ["ยกเลิกไปแล้ว"]);
    assert.equal(store.txs.size, 0);
});

test("picking a category saves the item, learns the word and ends with the summary", async () => {
    const store = store0();
    const d = await opened(store);
    const msgs = await run(store, tap({ a: "cat", d, i: 1, c: "other" }));
    assert.equal(store.txs.size, 2);
    const cat = [...store.txs.values()].find((t) => t.note === "ค่าแมว");
    assert.deepEqual([cat.category, cat.type, cat.amount], ["other", "expense", 300]);
    assert.equal(store.words.u1["ค่าแมว"], "other");
    assert.match(str(msgs), /บันทึกแล้ว 2 รายการ/);
});

test("with two unknown items the next question carries a saved line", async () => {
    const store = store0();
    const d = await opened(store, "ค่าแมว 300 ค่าหมา 200");
    const msgs = await run(store, tap({ a: "cat", d, i: 0, c: "other" }));
    assert.equal(msgs[0].text, "✓ บันทึก “ค่าแมว” แล้ว\nเลือกหมวดของ “ค่าหมา 200 บาท”");
});

test("an unknown category key or another user's draft writes nothing", async () => {
    const store = store0();
    const d = await opened(store);
    assert.deepEqual(texts(await run(store, tap({ a: "cat", d, i: 1, c: "hacker" }))), ["ไม่พบหมวดนี้ ลองเลือกใหม่อีกครั้ง"]);
    assert.deepEqual(texts(await run(store, tap({ a: "cat", d, i: 1, c: "other" }, undefined, "U2"))), ["ไม่พบรายการนี้"]);
    assert.deepEqual(texts(await run(store, tap({ a: "undo", d }, undefined, "U2"))), ["ไม่พบรายการนี้"]);
    assert.deepEqual(texts(await run(store, tap({ a: "cat", d: "nope", i: 0, c: "food" }))), ["ไม่พบรายการนี้"]);
    assert.equal(store.txs.size, 1);
    assert.equal(store.words.u1, undefined);
});

test("skip leaves the item unsaved and moves on", async () => {
    const store = store0();
    const d = await opened(store);
    const msgs = await run(store, tap({ a: "skip", d, i: 1 }));
    assert.equal(store.txs.size, 1);
    assert.equal(store.drafts.get(d).items[1].state, "skipped");
    assert.match(str(msgs), /ไม่บันทึก: ค่าแมว 300/);
});

test("types switches the quick reply between expense and income lists", async () => {
    const store = store0();
    const d = await opened(store);
    const [msg] = await run(store, tap({ a: "types", d, i: 1, k: "income", m: "pick" }));
    const labels = msg.quickReply.items.map((x) => x.action.label);
    assert.deepEqual(labels, ["เงินเดือน", "โบนัส", "งานเสริม", "รายรับอื่นๆ", "รายจ่าย…", "ไม่บันทึก"]);
    await run(store, tap({ a: "cat", d, i: 1, c: "freelance" }));
    assert.equal([...store.txs.values()].find((t) => t.note === "ค่าแมว").type, "income");
});

test("fix lists saved items, then fixcat updates the transaction and learns", async () => {
    const store = store0();
    const d = await opened(store, "ค่าน้ำ 15");
    const [list] = await run(store, tap({ a: "fix", d }));
    assert.equal(list.quickReply.items.length, 1);
    const [cats] = await run(store, tap({ a: "fix", d, i: 0 }));
    assert.equal(cats.quickReply.items.length, 10);
    const msgs = await run(store, tap({ a: "fixcat", d, i: 0, c: "food" }));
    assert.equal([...store.txs.values()][0].category, "food");
    assert.equal(store.words.u1["ค่าน้ำ"], "food");
    assert.match(str(msgs), /อาหาร\/เครื่องดื่ม/);
});

test("fixcat on a transaction deleted on the web still learns and says so", async () => {
    const store = store0();
    const d = await opened(store, "ค่าน้ำ 15");
    store.txs.clear();
    assert.deepEqual(texts(await run(store, tap({ a: "fixcat", d, i: 0, c: "food" }))), [
        "รายการนี้ถูกลบไปแล้ว แต่ระบบจำหมวดของคำนี้ไว้ให้แล้ว",
    ]);
    assert.equal(store.words.u1["ค่าน้ำ"], "food");
    assert.equal(store.txs.size, 0);
});

test("fix with nothing saved says so", async () => {
    const store = store0();
    const d = await opened(store, "ค่าแมว 300");
    assert.deepEqual(texts(await run(store, tap({ a: "fix", d }))), ["ยังไม่มีรายการที่บันทึก"]);
});

test("undo removes everything saved from the message, even when over the limit", async () => {
    const store = store0();
    const d = await opened(store, "ค่าข้าว 50 ค่าน้ำ 100");
    store.usage.set("u1", { ...store.usage.get("u1"), limitPerDay: 0, warnedDay: true });
    assert.deepEqual(texts(await run(store, tap({ a: "undo", d }))), ["เลิกทำแล้ว ลบ 2 รายการ"]);
    assert.equal(store.txs.size, 0);
    assert.deepEqual(texts(await run(store, tap({ a: "undo", d }))), ["เลิกทำไปแล้ว"]);
});

test("buttons on drafts older than 7 days report expiry", async () => {
    const store = store0();
    const d = await awaiting(store, "ค่าข้าว 50");
    const later = new Date(NOW.getTime() + 8 * 24 * 60 * 60 * 1000);
    assert.deepEqual(texts(await run(store, tap({ a: "date", d, v: "today" }), later)), ["รายการนี้หมดอายุแล้ว พิมพ์ใหม่อีกครั้ง"]);
    assert.equal(store.txs.size, 0);
});

test("asking about an already saved item, or before choosing a date, is answered plainly", async () => {
    const store = store0();
    const d = await awaiting(store);
    assert.deepEqual(texts(await run(store, tap({ a: "ask", d, i: 1 }))), ["รายการนี้ยังไม่ได้เลือกวัน"]);
    await run(store, tap({ a: "date", d, v: "today" }));
    assert.deepEqual(texts(await run(store, tap({ a: "ask", d, i: 0 }))), ["รายการนี้จัดการไปแล้ว"]);
    assert.equal((await run(store, tap({ a: "ask", d, i: 1 })))[0].quickReply.items.length, 11);
});

test("a concurrent write conflict asks the user to retry and writes nothing", async () => {
    const store = store0();
    const d = await awaiting(store, "ค่าข้าว 50");
    store.failNextApply = true;
    assert.deepEqual(texts(await run(store, tap({ a: "date", d, v: "today" }))), ["มีการกดซ้อนกัน ลองใหม่อีกครั้ง"]);
    assert.equal(store.txs.size, 0);
});

test("the personal dictionary stops growing at 500 words but existing words still update", async () => {
    const full = Object.fromEntries(Array.from({ length: 499 }, (_, i) => [`คำ${i}`, "other"]));
    const store = store0({ words: { u1: { ...full, "ค่าน้ำ": "bills" } } });
    const d = await opened(store, "ค่าแมว 300 ค่าน้ำ 15");
    await run(store, tap({ a: "cat", d, i: 0, c: "other" }));
    assert.equal(store.words.u1["ค่าแมว"], undefined);
    await run(store, tap({ a: "fixcat", d, i: 1, c: "food" }));
    assert.equal(store.words.u1["ค่าน้ำ"], "food");
    assert.equal(Object.keys(store.words.u1).length, 500);
});
