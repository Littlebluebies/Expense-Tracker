import { test } from "node:test";
import assert from "node:assert/strict";
import { handleEvent } from "./bot.mjs";
import { createFakeStore } from "./testing/fakes.mjs";

const NOW = new Date("2026-10-14T05:00:00Z"); // เที่ยงวันเวลาไทย
const LIMITS = { perMinute: 20, perDay: 300 };
const WEB = "https://app.test";
const ANN = { U1: { userId: "u1", displayName: "Ann" } };
const linkedStore = (extra = {}) => createFakeStore({ links: ANN, ...extra });
const text = (t, id = "m1", userId = "U1") => ({
    type: "message",
    replyToken: "rt",
    source: { userId },
    message: { type: "text", id, text: t },
});
const run = (store, event, { now = NOW, limits = LIMITS } = {}) => handleEvent(event, { store, now, limits, webUrl: WEB });
const str = (m) => JSON.stringify(m);

test("an unlinked LINE user gets the link card; nothing is counted or stored", async () => {
    const store = createFakeStore();
    const msgs = await run(store, text("ค่าข้าว 50"));
    assert.equal(msgs.length, 1);
    assert.match(str(msgs), /เข้าสู่ระบบ \/ เชื่อมบัญชี/);
    assert.match(str(msgs), /https:\/\/app\.test\//);
    assert.equal(store.quotaCalls, 0);
    assert.equal(store.drafts.size, 0);
});

test("follow greets linked and unlinked users differently", async () => {
    const follow = (userId) => ({ type: "follow", replyToken: "rt", source: { userId } });
    assert.match((await run(linkedStore(), follow("U1")))[0].text, /เริ่มจดได้เลย/);
    assert.match(str(await run(linkedStore(), follow("U9"))), /เชื่อมบัญชีที่หน้าเว็บ/);
});

test("stickers and events without a reply token are ignored without reading anything", async () => {
    const store = linkedStore();
    let reads = 0;
    const find = store.findLink;
    store.findLink = async (...args) => {
        reads += 1;
        return find(...args);
    };
    const sticker = { type: "message", replyToken: "rt", source: { userId: "U1" }, message: { type: "sticker", id: "s1" } };
    assert.deepEqual(await run(store, sticker), []);
    assert.deepEqual(await run(store, { ...text("ค่าข้าว 50"), replyToken: undefined }), []);
    assert.deepEqual(await run(store, { type: "unfollow", source: { userId: "U1" } }), []);
    assert.equal(reads, 0);
    assert.equal(store.quotaCalls, 0);
});

test("สรุป reports this month's totals and the month's budget", async () => {
    const store = linkedStore({ budgets: { u1: { budget: 10000, monthly: { "2026-10": 2000 } } } });
    store.txs.set("a", { userId: "u1", type: "expense", amount: 500, date: new Date("2026-10-02T05:00:00Z") });
    store.txs.set("b", { userId: "u1", type: "income", amount: 3000, date: new Date("2026-10-05T05:00:00Z") });
    store.txs.set("c", { userId: "u1", type: "expense", amount: 999, date: new Date("2026-09-30T05:00:00Z") });
    store.txs.set("d", { userId: "u2", type: "expense", amount: 777, date: new Date("2026-10-03T05:00:00Z") });
    const out = str(await run(store, text("สรุป")));
    assert.match(out, /สรุป ต\.ค\. 2569/);
    assert.match(out, /รายรับ 3,000 บาท/);
    assert.match(out, /รายจ่าย 500 บาท/);
    assert.match(out, /คงเหลือ 2,500 บาท/);
    assert.match(out, /ใช้ไป 25% ของงบ เหลือ 1,500 บาท/);
    assert.match(str(await run(store, text("เดือนนี้", "m2"))), /สรุป ต\.ค\. 2569/);
});

test("help words and messages without an amount reply with examples and store nothing", async () => {
    const store = linkedStore();
    assert.match((await run(store, text("วิธีใช้")))[0].text, /ค่าข้าว 50/);
    assert.match((await run(store, text("HELP")))[0].text, /ค่าข้าว 50/);
    assert.match((await run(store, text("สวัสดี")))[0].text, /^ไม่พบจำนวนเงินในข้อความ/);
    assert.equal(store.drafts.size, 0);
});

test("a parse error is explained and nothing is stored", async () => {
    const store = linkedStore();
    assert.deepEqual((await run(store, text("15/10/2026 ค่าข้าว 50"))).map((m) => m.text), ["บันทึกล่วงหน้าไม่ได้ ใส่วันที่ไม่เกินวันนี้"]);
    assert.equal(store.drafts.size, 0);
});

test("the spec example asks for a date and saves nothing yet", async () => {
    const store = linkedStore();
    const msgs = await run(store, text("ค่าข้าวตอนกลางวัน 50 บาท ค่าน้ำ 100 บาท ค่าเน็ต 20 บาท", "m9"));
    assert.match(str(msgs), /เป็นของวันไหน/);
    assert.match(str(msgs), /"type":"datetimepicker"/);
    const draft = store.drafts.get("m9");
    assert.equal(draft.status, "awaitingDate");
    assert.equal(draft.version, 0);
    assert.deepEqual(draft.items.map((it) => it.category), ["food", "bills", "bills"]);
    assert.ok(draft.expiresAt.getTime() - NOW.getTime() === 7 * 24 * 60 * 60 * 1000);
    assert.equal(store.txs.size, 0);
});

test("a typed date saves known items at noon Bangkok time right away", async () => {
    const store = linkedStore();
    const msgs = await run(store, text("เมื่อวาน ค่าข้าว 50"));
    assert.equal(store.txs.size, 1);
    const tx = [...store.txs.values()][0];
    assert.deepEqual(
        { ...tx, date: tx.date.toISOString() },
        { userId: "u1", amount: 50, type: "expense", category: "food", note: "ค่าข้าว", date: "2026-10-13T05:00:00.000Z", createdAt: "server" }
    );
    assert.match(str(msgs), /บันทึกแล้ว 1 รายการ · เมื่อวาน/);
    assert.equal(store.drafts.get("m1").status, "open");
});

test("unknown words: known items are saved, then a category question follows", async () => {
    const store = linkedStore();
    const msgs = await run(store, text("เมื่อวาน ค่าแมว 300 ค่าข้าว 50"));
    assert.equal(store.txs.size, 1);
    assert.equal(msgs.length, 2);
    assert.equal(msgs[1].text, "เลือกหมวดของ “ค่าแมว 300 บาท”");
    assert.equal(msgs[1].quickReply.items.length, 11);
});

test("personal words categorize without asking", async () => {
    const store = linkedStore({ words: { u1: { "ค่าแมว": "other" } } });
    await run(store, text("เมื่อวาน ค่าแมว 300"));
    assert.equal([...store.txs.values()][0].category, "other");
});

test("a redelivered message is not processed twice", async () => {
    const store = linkedStore();
    await run(store, text("เมื่อวาน ค่าข้าว 50", "dup"));
    assert.deepEqual(await run(store, text("เมื่อวาน ค่าข้าว 50", "dup")), []);
    assert.equal(store.txs.size, 1);
});

test("expired drafts are removed when a new message arrives", async () => {
    const store = linkedStore();
    store.drafts.set("old", { userId: "u1", status: "awaitingDate", items: [], expiresAt: new Date("2026-10-01T00:00:00Z"), version: 0 });
    store.drafts.set("other-user", { userId: "u2", status: "awaitingDate", items: [], expiresAt: new Date("2026-10-01T00:00:00Z"), version: 0 });
    await run(store, text("ค่าข้าว 50", "m2"));
    assert.equal(store.drafts.has("old"), false);
    assert.equal(store.drafts.has("other-user"), true);
    assert.equal(store.drafts.has("m2"), true);
});

test("the per-minute limit warns once, then stays silent, and resets the next minute", async () => {
    const store = linkedStore();
    const limits = { perMinute: 2, perDay: 300 };
    await run(store, text("ค่าข้าว 50", "a"), { limits });
    await run(store, text("ค่าข้าว 50", "b"), { limits });
    assert.deepEqual((await run(store, text("ค่าข้าว 50", "c"), { limits })).map((m) => m.text), ["ส่งเร็วเกินไป รอสักครู่แล้วลองใหม่"]);
    assert.deepEqual(await run(store, text("ค่าข้าว 50", "d"), { limits }), []);
    assert.equal(store.drafts.has("c") || store.drafts.has("d"), false);
    const later = new Date(NOW.getTime() + 60_000);
    assert.match(str(await run(store, text("ค่าข้าว 50", "e"), { limits, now: later })), /เป็นของวันไหน/);
});

test("a per-user daily limit of 0 suspends the bot after one warning", async () => {
    const store = linkedStore();
    store.usage.set("u1", { limitPerDay: 0 });
    assert.match(str(await run(store, text("ค่าข้าว 50", "a"))), /วันนี้ใช้ครบแล้ว/);
    assert.deepEqual(await run(store, text("ค่าข้าว 50", "b")), []);
});
