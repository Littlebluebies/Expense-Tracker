import { test } from "node:test";
import assert from "node:assert/strict";
import {
    MSG, baht, categoryQuickReply, dateCard, errorText, fixItemsQuickReply, helpMessage, limitMessage,
    monthSummaryMessage, notLinkedMessage, statusText, summaryCard, welcomeMessage,
} from "./messages.mjs";

const TODAY = "2026-10-14";
const ID = "123456789012345678";
const item = (over = {}) => ({ note: "ค่าข้าว", amount: 50, type: "expense", category: "food", state: "pending", txId: null, ...over });
const draft = (items, over = {}) => ({ userId: "u1", date: null, status: "awaitingDate", ignored: null, items, version: 0, ...over });
const str = (m) => JSON.stringify(m);
const findAll = (node, pred, out = []) => {
    if (node && typeof node === "object") {
        if (pred(node)) out.push(node);
        for (const v of Object.values(node)) findAll(v, pred, out);
    }
    return out;
};

test("baht formats Thai thousands and up to 2 decimals", () => {
    assert.equal(baht(1234.5), "1,234.5");
    assert.equal(baht(-1000), "-1,000");
});

test("quick replies stay within LINE limits for every kind and mode", () => {
    const long = item({ note: "ค่าอาหารแมวยี่ห้อพิเศษราคาแพงมากๆ" });
    for (const kind of ["expense", "income"]) {
        for (const mode of ["pick", "fix"]) {
            const msg = categoryQuickReply({ draftId: ID, index: 9, item: long, kind, mode });
            assert.ok(msg.quickReply.items.length <= 13);
            for (const { action } of msg.quickReply.items) {
                assert.ok(action.label.length <= 20, action.label);
                assert.ok(action.data.length <= 300);
            }
        }
    }
    assert.equal(categoryQuickReply({ draftId: ID, index: 0, item: long, kind: "expense", mode: "pick" }).quickReply.items.length, 11);
    assert.equal(categoryQuickReply({ draftId: ID, index: 0, item: long, kind: "income", mode: "pick" }).quickReply.items.length, 6);
    assert.equal(categoryQuickReply({ draftId: ID, index: 0, item: long, kind: "expense", mode: "fix" }).quickReply.items.length, 10);
});

test("pick mode sends cat and has a skip button; fix mode sends fixcat and no skip", () => {
    const pick = str(categoryQuickReply({ draftId: ID, index: 2, item: item(), kind: "expense", mode: "pick" }));
    assert.match(pick, /a=cat&d=123456789012345678&i=2&c=food/);
    assert.match(pick, /a=skip/);
    assert.match(pick, /a=types&d=123456789012345678&i=2&k=income&m=pick/);
    const fix = str(categoryQuickReply({ draftId: ID, index: 2, item: item(), kind: "income", mode: "fix" }));
    assert.match(fix, /a=fixcat&d=123456789012345678&i=2&c=salary/);
    assert.doesNotMatch(fix, /a=skip/);
    assert.match(fix, /k=expense&m=fix/);
});

test("the category question names the item and can carry a lead line", () => {
    const msg = categoryQuickReply({ draftId: ID, index: 0, item: item({ note: "ค่าแมว", amount: 300 }), kind: "expense", mode: "pick", lead: MSG.savedOne("ค่าข้าว") });
    assert.equal(msg.text, "✓ บันทึก “ค่าข้าว” แล้ว\nเลือกหมวดของ “ค่าแมว 300 บาท”");
});

test("fixItemsQuickReply lists only saved items with clipped labels", () => {
    const d = draft([item({ state: "saved", txId: "t1", note: "ค่าอาหารแมวยี่ห้อพิเศษราคาแพงมากๆ" }), item({ state: "pending" })], { status: "open", date: TODAY });
    const msg = fixItemsQuickReply(ID, d);
    assert.equal(msg.quickReply.items.length, 1);
    assert.ok(msg.quickReply.items[0].action.label.length <= 20);
    assert.match(msg.quickReply.items[0].action.data, /a=fix&d=123456789012345678&i=0/);
});

test("dateCard lists items, flags unknown categories and ignored text, and limits the picker to today", () => {
    const d = draft([item(), item({ note: "ค่าแมว", amount: 300, category: null })], { ignored: "ค่าน้ำ" });
    const card = dateCard(ID, d, TODAY);
    const s = str(card);
    assert.equal(card.type, "flex");
    assert.match(card.altText, /2 รายการ · รวม 350 บาท/);
    assert.match(s, /\? ยังไม่รู้หมวด/);
    assert.match(s, /ไม่ได้บันทึก: “ค่าน้ำ” \(ไม่มีจำนวนเงิน\)/);
    assert.match(s, /เป็นของวันไหน\?/);
    const [picker] = findAll(card, (n) => n.type === "datetimepicker");
    assert.deepEqual([picker.mode, picker.initial, picker.max], ["date", TODAY, TODAY]);
    assert.match(s, /a=date&d=123456789012345678&v=today/);
    assert.match(s, /a=date&d=123456789012345678&v=yesterday/);
    assert.match(s, /a=cancel&d=123456789012345678/);
});

test("summaryCard shows saved items, ask buttons for pending ones and fix/undo only when something is saved", () => {
    const d = draft(
        [item({ state: "saved", txId: "t1" }), item({ note: "ค่าแมว", amount: 300, category: null, state: "pending" }), item({ note: "ขนม", amount: 20, state: "skipped" })],
        { status: "open", date: TODAY }
    );
    const s = str(summaryCard(ID, d, TODAY));
    assert.match(s, /✓ บันทึกแล้ว 1 รายการ · วันนี้ \(14 ต\.ค\.\) · รวม 50 บาท/);
    assert.match(s, /a=ask&d=123456789012345678&i=1/);
    assert.match(s, /ไม่บันทึก: ขนม 20/);
    assert.match(s, /a=fix&d=123456789012345678/);
    assert.match(s, /a=undo&d=123456789012345678/);

    const none = str(summaryCard(ID, draft([item({ category: null })], { status: "open", date: TODAY }), TODAY));
    assert.match(none, /รอเลือกหมวด · วันนี้/);
    assert.doesNotMatch(none, /a=undo/);
});

test("mixed income and expense cards show the two totals separately, never one sum", () => {
    const salary = item({ note: "เงินเดือน", amount: 25000, type: "income", category: "salary" });
    const d = draft([salary, item()], { date: TODAY, status: "awaitingDate" });
    const card = dateCard(ID, d, TODAY);
    assert.match(card.altText, /2 รายการ · รายรับ 25,000 · รายจ่าย 50 บาท/);
    assert.doesNotMatch(str(card), /รวม 25,050/);

    const saved = draft([{ ...salary, state: "saved", txId: "t2" }, { ...item(), state: "saved", txId: "t1" }], { status: "open", date: TODAY });
    const summary = str(summaryCard(ID, saved, TODAY));
    assert.match(summary, /รายรับ 25,000 · รายจ่าย 50 บาท/);
    assert.doesNotMatch(summary, /รวม 25,050/);
});

test("monthSummaryMessage shows totals, budget use and a web button", () => {
    const under = str(monthSummaryMessage({ today: TODAY, income: 3000, expense: 5000, budget: 10000, webUrl: "https://app.test" }));
    assert.match(under, /สรุป ต\.ค\. 2569/);
    assert.match(under, /รายรับ 3,000 บาท/);
    assert.match(under, /รายจ่าย 5,000 บาท/);
    assert.match(under, /คงเหลือ -2,000 บาท/);
    assert.match(under, /ใช้ไป 50% ของงบ เหลือ 5,000 บาท/);
    assert.match(under, /https:\/\/app\.test\/dashboard/);
    assert.match(str(monthSummaryMessage({ today: TODAY, income: 0, expense: 12000, budget: 10000, webUrl: "w" })), /เกินงบ 2,000 บาท/);
    assert.doesNotMatch(str(monthSummaryMessage({ today: TODAY, income: 0, expense: 1, budget: 0, webUrl: "w" })), /งบ/);
});

test("fixed messages", () => {
    assert.match(helpMessage().text, /ค่าข้าว 50/);
    assert.match(helpMessage(MSG.noAmount).text, /^ไม่พบจำนวนเงินในข้อความ\n\n/);
    assert.match(str(notLinkedMessage("https://app.test")), /https:\/\/app\.test\//);
    assert.equal(welcomeMessage(true, "w").type, "text");
    assert.match(str(welcomeMessage(false, "https://app.test")), /เชื่อมบัญชี/);
    assert.equal(limitMessage("warnMinute", "w").text, "ส่งเร็วเกินไป รอสักครู่แล้วลองใหม่");
    assert.match(str(limitMessage("warnDay", "https://app.test")), /วันนี้ใช้ครบแล้ว.*https:\/\/app\.test\/dashboard/);
    for (const code of ["invalid_date", "future_date", "too_many_items", "amount_too_large"]) assert.ok(errorText(code).length > 0);
    assert.equal(statusText("open"), "บันทึกไปแล้ว");
    assert.equal(statusText("undone"), "เลิกทำไปแล้ว");
    assert.equal(statusText("cancelled"), "ยกเลิกไปแล้ว");
    assert.equal(MSG.undone(2), "เลิกทำแล้ว ลบ 2 รายการ");
});
