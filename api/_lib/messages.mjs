import { EXPENSE, INCOME, categoryOf } from "./categories.mjs";
import { dateLabel, monthLabel } from "./thaiDate.mjs";
import { encodePostback } from "./postback.mjs";

// ข้อความที่บอทตอบ (Flex Message สำหรับการ์ดที่ปุ่มต้องค้างอยู่ในแชท, quick reply สำหรับเลือกหมวด)
// https://developers.line.biz/en/reference/messaging-api/#message-objects

export const baht = (n) => Number(n).toLocaleString("th-TH", { maximumFractionDigits: 2 });
export const clip = (s, max) => (s.length <= max ? s : `${s.slice(0, max - 1)}…`);
const MUTED = "#6b7280";

export const MSG = {
    noAmount: "ไม่พบจำนวนเงินในข้อความ",
    notFound: "ไม่พบรายการนี้",
    expired: "รายการนี้หมดอายุแล้ว พิมพ์ใหม่อีกครั้ง",
    badDate: "เลือกวันที่ไม่เกินวันนี้",
    badCategory: "ไม่พบหมวดนี้ ลองเลือกใหม่อีกครั้ง",
    cancelled: "ยกเลิกแล้ว ไม่ได้บันทึกรายการ",
    alreadyDone: "รายการนี้จัดการไปแล้ว",
    nothingSaved: "ยังไม่มีรายการที่บันทึก",
    txGone: "รายการนี้ถูกลบไปแล้ว แต่ระบบจำหมวดของคำนี้ไว้ให้แล้ว",
    conflict: "มีการกดซ้อนกัน ลองใหม่อีกครั้ง",
    systemError: "ขออภัย ระบบขัดข้อง ลองใหม่อีกครั้ง",
    tooFast: "ส่งเร็วเกินไป รอสักครู่แล้วลองใหม่",
    dayLimit: "วันนี้ใช้ครบแล้ว จดต่อได้ที่เว็บ",
    undone: (n) => `เลิกทำแล้ว ลบ ${n} รายการ`,
    savedOne: (note) => `✓ บันทึก “${note || "(ไม่มีชื่อ)"}” แล้ว`,
};

const ERRORS = {
    invalid_date: "วันที่ไม่ถูกต้อง ลองพิมพ์ใหม่ เช่น 12/10 ค่าข้าว 50",
    future_date: "บันทึกล่วงหน้าไม่ได้ ใส่วันที่ไม่เกินวันนี้",
    too_many_items: "ส่งได้ครั้งละไม่เกิน 10 รายการ ลองแยกเป็นหลายข้อความ",
    amount_too_large: "จำนวนเงินต้องไม่เกิน 1,000,000,000 บาท",
};
export const errorText = (code) => ERRORS[code] || MSG.systemError;

const STATUS = {
    awaitingDate: "รายการนี้ยังไม่ได้เลือกวัน",
    open: "บันทึกไปแล้ว",
    undone: "เลิกทำไปแล้ว",
    cancelled: "ยกเลิกไปแล้ว",
};
export const statusText = (status) => STATUS[status] || MSG.notFound;

export const textMessage = (text, quickReply) => (quickReply ? { type: "text", text, quickReply } : { type: "text", text });

const HELP = [
    "พิมพ์รายการพร้อมจำนวนเงิน เช่น",
    "• ค่าข้าว 50",
    "• ค่าข้าวกลางวัน 50 บาท ค่าน้ำ 100 ค่าเน็ต 20",
    "• เมื่อวาน ค่าแท็กซี่ 120",
    "• 12/10 เงินเดือน 25000",
    "พิมพ์ “สรุป” เพื่อดูยอดเดือนนี้",
].join("\n");
export const helpMessage = (lead) => textMessage(lead ? `${lead}\n\n${HELP}` : HELP);

// ---------- ชิ้นส่วน Flex ----------

const postbackAction = (label, fields, displayText = label) => ({
    type: "postback",
    label,
    data: encodePostback(fields),
    displayText,
});
const uriAction = (label, uri) => ({ type: "uri", label, uri });
const button = (action, style = "secondary") => ({ type: "button", style, height: "sm", action });
const text = (value, extra = {}) => ({ type: "text", text: value, wrap: true, ...extra });
const row = (contents) => ({ type: "box", layout: "horizontal", spacing: "sm", contents });
const bubble = (altText, body, footer) => ({
    type: "flex",
    altText: clip(altText, 400),
    contents: {
        type: "bubble",
        body: { type: "box", layout: "vertical", spacing: "sm", contents: body },
        ...(footer ? { footer: { type: "box", layout: "vertical", spacing: "sm", contents: footer } } : {}),
    },
});
const linkCard = (message, label, uri) => bubble(message, [text(message)], [button(uriAction(label, uri), "primary")]);

// คนที่มีบัญชีอีเมลอยู่แล้วต้องเชื่อมจากหน้าตั้งค่า ถ้ากด "เข้าสู่ระบบด้วย LINE" จะได้บัญชีใหม่แยกกัน
const NOT_LINKED = [
    "ยังไม่ได้เชื่อมบัญชี LINE กับแอป",
    "• มีบัญชีอีเมลอยู่แล้ว: เข้าสู่ระบบด้วยอีเมล แล้วไปที่ ตั้งค่า › LINE › เชื่อมบัญชี LINE",
    "• ยังไม่มีบัญชี: กด “เข้าสู่ระบบด้วย LINE” ที่หน้าเว็บ",
].join("\n");
const notLinkedCard = (message, webUrl) =>
    bubble(
        message,
        [text(message)],
        [
            button(uriAction("เชื่อมกับบัญชีอีเมลเดิม", `${webUrl}/settings`), "primary"),
            button(uriAction("เริ่มใช้ด้วย LINE", `${webUrl}/`)),
        ]
    );

export const notLinkedMessage = (webUrl) => notLinkedCard(NOT_LINKED, webUrl);

export const welcomeMessage = (linked, webUrl) =>
    linked
        ? textMessage(`สวัสดี! เริ่มจดได้เลย\n\n${HELP}`)
        : notLinkedCard(`สวัสดี! บอทนี้ช่วยจดรายรับ-รายจ่ายจากแชท\n\n${NOT_LINKED}`, webUrl);

export const limitMessage = (decision, webUrl) =>
    decision === "warnMinute" ? textMessage(MSG.tooFast) : linkCard(MSG.dayLimit, "เปิดเว็บ", `${webUrl}/dashboard`);

// ---------- รายการ ----------

const noteOf = (it) => it.note || "(ไม่มีชื่อ)";
const signed = (it) => `${it.type === "income" ? "+" : ""}${baht(it.amount)}`;
const sumOf = (items) => items.reduce((sum, it) => sum + it.amount, 0);
// รายรับกับรายจ่ายรวมกันไม่ได้ จึงแยกยอดเมื่อมีทั้งสองแบบในข้อความเดียว
const totalText = (items) => {
    const income = items.filter((it) => it.type === "income");
    const expense = items.filter((it) => it.type !== "income");
    if (income.length && expense.length) return `รายรับ ${baht(sumOf(income))} · รายจ่าย ${baht(sumOf(expense))} บาท`;
    return `รวม ${baht(sumOf(items))} บาท`;
};
const categoryText = (it) => (it.category ? categoryOf(it.category)?.label ?? it.category : "? ยังไม่รู้หมวด");
const itemRow = (it) => ({
    type: "box",
    layout: "vertical",
    contents: [
        row([text(noteOf(it), { size: "sm", flex: 5 }), text(signed(it), { size: "sm", flex: 3, align: "end" })]),
        text(categoryText(it), { size: "xs", color: MUTED }),
    ],
});
const ignoredLine = (draft) =>
    draft.ignored ? [text(`ไม่ได้บันทึก: “${draft.ignored}” (ไม่มีจำนวนเงิน)`, { size: "xs", color: MUTED })] : [];

export function dateCard(draftId, draft, today) {
    const title = `${draft.items.length} รายการ · ${totalText(draft.items)}`;
    const body = [
        text(title, { weight: "bold" }),
        ...draft.items.map(itemRow),
        ...ignoredLine(draft),
        text("เป็นของวันไหน?", { weight: "bold", margin: "md" }),
    ];
    const footer = [
        row([
            button(postbackAction("วันนี้", { a: "date", d: draftId, v: "today" }), "primary"),
            button(postbackAction("เมื่อวาน", { a: "date", d: draftId, v: "yesterday" }), "primary"),
        ]),
        button({
            type: "datetimepicker",
            label: "เลือกวัน…",
            data: encodePostback({ a: "date", d: draftId, v: "pick" }),
            mode: "date",
            initial: today,
            max: today,
        }),
        button(postbackAction("ยกเลิก", { a: "cancel", d: draftId }), "link"),
    ];
    return bubble(`${title} — เลือกวันที่`, body, footer);
}

export function summaryCard(draftId, draft, today) {
    const saved = draft.items.filter((it) => it.state === "saved");
    const when = dateLabel(draft.date, today);
    const title = saved.length
        ? `✓ บันทึกแล้ว ${saved.length} รายการ · ${when} · ${totalText(saved)}`
        : `รอเลือกหมวด · ${when}`;
    const body = [text(title, { weight: "bold" })];
    draft.items.forEach((it, i) => {
        if (it.state === "saved") body.push(itemRow(it));
        if (it.state === "pending") {
            body.push(
                row([
                    text(`? ${noteOf(it)} ${signed(it)}`, { size: "sm", flex: 5, gravity: "center" }),
                    { ...button(postbackAction("เลือกหมวด", { a: "ask", d: draftId, i }, `เลือกหมวด: ${noteOf(it)}`)), flex: 4 },
                ])
            );
        }
        if (it.state === "skipped") body.push(text(`ไม่บันทึก: ${noteOf(it)} ${signed(it)}`, { size: "xs", color: MUTED }));
    });
    body.push(...ignoredLine(draft));
    const footer = saved.length
        ? [row([button(postbackAction("แก้หมวด", { a: "fix", d: draftId })), button(postbackAction("เลิกทำ", { a: "undo", d: draftId }))])]
        : null;
    return bubble(title, body, footer);
}

export function categoryQuickReply({ draftId, index, item, kind, mode, lead }) {
    const action = mode === "fix" ? "fixcat" : "cat";
    const cats = kind === "income" ? INCOME : EXPENSE;
    const actions = cats.map((c) => postbackAction(c.short, { a: action, d: draftId, i: index, c: c.key }, `หมวด: ${c.label}`));
    const other = kind === "income" ? "expense" : "income";
    actions.push(postbackAction(other === "income" ? "รายรับ…" : "รายจ่าย…", { a: "types", d: draftId, i: index, k: other, m: mode }));
    if (mode === "pick") actions.push(postbackAction("ไม่บันทึก", { a: "skip", d: draftId, i: index }, `ไม่บันทึก: ${noteOf(item)}`));
    const ask = `${mode === "fix" ? "แก้หมวด" : "เลือกหมวด"}ของ “${noteOf(item)} ${baht(item.amount)} บาท”`;
    return textMessage(lead ? `${lead}\n${ask}` : ask, { items: actions.map((a) => ({ type: "action", action: a })) });
}

export function fixItemsQuickReply(draftId, draft) {
    const items = [];
    draft.items.forEach((it, i) => {
        if (it.state !== "saved") return;
        const label = clip(`${noteOf(it)} ${baht(it.amount)}`, 20);
        items.push({ type: "action", action: postbackAction(label, { a: "fix", d: draftId, i }, `แก้หมวด: ${noteOf(it)}`) });
    });
    return textMessage("จะแก้หมวดของรายการไหน?", { items });
}

export function monthSummaryMessage({ today, income, expense, budget, webUrl }) {
    const lines = [
        `สรุป ${monthLabel(today)}`,
        `รายรับ ${baht(income)} บาท`,
        `รายจ่าย ${baht(expense)} บาท`,
        `คงเหลือ ${baht(income - expense)} บาท`,
    ];
    if (budget > 0) {
        lines.push(
            expense <= budget
                ? `ใช้ไป ${Math.round((expense / budget) * 100)}% ของงบ เหลือ ${baht(budget - expense)} บาท`
                : `เกินงบ ${baht(expense - budget)} บาท`
        );
    }
    const [head, ...rest] = lines;
    return bubble(
        lines.join("\n"),
        [text(head, { weight: "bold" }), ...rest.map((line) => text(line, { size: "sm" }))],
        [button(uriAction("เปิดเว็บ", `${webUrl}/dashboard`), "primary")]
    );
}
