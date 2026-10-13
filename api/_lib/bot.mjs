import { learnKey, parseMessage } from "./parse.mjs";
import { decodePostback } from "./postback.mjs";
import { isCategory, typeOf } from "./categories.mjs";
import { addDays, bangkokYmd, minuteIndex, monthBounds, monthKey, noonBangkok } from "./thaiDate.mjs";
import {
    MSG, categoryQuickReply, dateCard, errorText, fixItemsQuickReply, helpMessage, limitMessage,
    monthSummaryMessage, notLinkedMessage, statusText, summaryCard, textMessage, welcomeMessage,
} from "./messages.mjs";

export const DRAFT_TTL_MS = 7 * 24 * 60 * 60 * 1000;
export const MAX_WORDS = 500;
const SUMMARY_WORDS = new Set(["สรุป", "เดือนนี้", "สรุปเดือนนี้"]);
const HELP_WORDS = new Set(["วิธีใช้", "help"]);
const YMD = /^\d{4}-\d{2}-\d{2}$/;

// event หนึ่งตัวจาก webhook -> ข้อความที่จะตอบ ([] = ไม่ตอบ)
// deps = { store, now, limits, webUrl } (store ดู interface ใน testing/fakes.mjs และ store.mjs)
export async function handleEvent(event, deps) {
    const { store, now, limits, webUrl } = deps;
    const lineUserId = event?.source?.userId;
    if (!lineUserId || !event.replyToken) return [];
    const isText = event.type === "message" && event.message?.type === "text";
    if (!isText && event.type !== "postback" && event.type !== "follow") return [];

    const link = await store.findLink(lineUserId);
    if (event.type === "follow") return [welcomeMessage(Boolean(link), webUrl)];
    if (!link) return [notLinkedMessage(webUrl)];

    const ctx = { ...deps, uid: link.userId, today: bangkokYmd(now) };
    const pb = event.type === "postback" ? decodePostback(event.postback?.data) : null;
    // เลิกทำ/ยกเลิก ต้องทำได้เสมอ (ทำได้ครั้งเดียวต่อรายการอยู่แล้ว)
    const exempt = pb?.a === "undo" || pb?.a === "cancel";
    if (!exempt) {
        const decision = await store.consumeQuota(ctx.uid, { today: ctx.today, minute: minuteIndex(now), limits });
        if (decision === "silent") return [];
        if (decision !== "ok") return [limitMessage(decision, webUrl)];
    }
    return isText ? onText(event, ctx) : onPostback(event, pb, ctx);
}

// ---------- ข้อความ ----------

async function onText(event, ctx) {
    const { store, uid, today, now } = ctx;
    const text = event.message.text.trim();
    if (SUMMARY_WORDS.has(text)) return [await monthSummary(ctx)];
    if (HELP_WORDS.has(text.toLowerCase())) return [helpMessage()];

    const parsed = parseMessage(text, { personal: await store.getWords(uid), today });
    if (parsed.error) return [textMessage(errorText(parsed.error))];
    if (parsed.items.length === 0) return [helpMessage(MSG.noAmount)];

    await store.deleteExpiredDrafts(uid, now);
    const id = event.message.id; // LINE ส่ง event ซ้ำ -> id เดิม -> createDraft คืน false
    const draft = {
        userId: uid,
        date: null,
        status: "awaitingDate",
        ignored: parsed.ignored,
        items: parsed.items.map((it) => ({ ...it, state: "pending", txId: null })),
        createdAt: now,
        expiresAt: new Date(now.getTime() + DRAFT_TTL_MS),
        version: 0,
    };
    if (!(await store.createDraft(id, draft))) return [];
    if (!parsed.date) return [dateCard(id, draft, today)];
    return commitDate(id, draft, parsed.date, ctx);
}

async function monthSummary({ store, uid, today, webUrl }) {
    const { start, end } = monthBounds(today);
    const [totals, budget] = await Promise.all([store.monthTotals(uid, start, end), store.getBudget(uid, monthKey(today))]);
    return monthSummaryMessage({ today, ...totals, budget, webUrl });
}

// ---------- บันทึก ----------

const txData = (uid, item, date) => ({
    userId: uid,
    amount: item.amount,
    type: item.type,
    category: item.category,
    note: item.note,
    date: noonBangkok(date),
});

function learnOp(uid, note, category, words) {
    const word = learnKey(note);
    if (!word) return null;
    if (!(word in words) && Object.keys(words).length >= MAX_WORDS) return null;
    return { uid, word, category };
}

async function apply(ctx, id, draft, next, ops, reply) {
    const res = await ctx.store.applyDraft(id, draft.version, {
        draft: next,
        creates: [],
        updates: [],
        deletes: [],
        learn: null,
        ...ops,
    });
    if (!res.ok) return [textMessage(MSG.conflict)];
    return reply(res);
}

const firstPending = (draft) => draft.items.findIndex((it) => it.state === "pending");

const question = (id, draft, k, lead) =>
    categoryQuickReply({ draftId: id, index: k, item: draft.items[k], kind: draft.items[k].type, mode: "pick", lead });

// หลังเลือกวัน: การ์ดสรุป + (ถ้ามี) คำถามหมวดของรายการแรกที่ยังไม่รู้หมวด
function afterSave(id, draft, today) {
    const k = firstPending(draft);
    const card = summaryCard(id, draft, today);
    return k === -1 ? [card] : [card, question(id, draft, k)];
}

// หลังเลือกหมวด/ข้าม: ถามรายการถัดไป หรือจบด้วยการ์ดสรุป
function nextQuestion(id, draft, today, lead) {
    const k = firstPending(draft);
    return k === -1 ? [summaryCard(id, draft, today)] : [question(id, draft, k, lead)];
}

function commitDate(id, draft, date, ctx) {
    const { store, uid, today } = ctx;
    const next = structuredClone(draft);
    next.date = date;
    next.status = "open";
    const creates = [];
    for (const it of next.items) {
        if (it.state !== "pending" || !it.category) continue;
        it.txId = store.newTxId();
        it.state = "saved";
        creates.push({ id: it.txId, data: txData(uid, it, date) });
    }
    return apply(ctx, id, draft, next, { creates }, () => afterSave(id, next, today));
}

// ---------- ปุ่ม ----------

async function onPostback(event, pb, ctx) {
    const { store, uid, today, now } = ctx;
    const id = pb.d;
    const draft = id ? await store.getDraft(id) : null;
    if (!draft || draft.userId !== uid) return [textMessage(MSG.notFound)];
    if (draft.expiresAt <= now) return [textMessage(MSG.expired)];
    const i = pb.i === undefined ? null : Number(pb.i);
    const item = i === null ? null : draft.items[i];

    if (pb.a === "date") {
        if (draft.status !== "awaitingDate") return [textMessage(statusText(draft.status))];
        const date = pb.v === "today" ? today : pb.v === "yesterday" ? addDays(today, -1) : event.postback?.params?.date;
        // max ของ datetimepicker บังคับได้แค่ในแอป LINE -> ตรวจซ้ำที่นี่
        if (!YMD.test(date || "") || date > today) return [textMessage(MSG.badDate)];
        return commitDate(id, draft, date, ctx);
    }
    if (pb.a === "cancel") {
        if (draft.status !== "awaitingDate") return [textMessage(statusText(draft.status))];
        return apply(ctx, id, draft, { ...draft, status: "cancelled" }, {}, () => [textMessage(MSG.cancelled)]);
    }
    if (pb.a === "undo") {
        if (draft.status !== "open") return [textMessage(statusText(draft.status))];
        const saved = draft.items.filter((it) => it.state === "saved");
        return apply(ctx, id, draft, { ...draft, status: "undone" }, { deletes: saved.map((it) => it.txId) }, () => [
            textMessage(MSG.undone(saved.length)),
        ]);
    }

    if (draft.status !== "open") return [textMessage(statusText(draft.status))];

    switch (pb.a) {
        case "ask":
            if (item?.state !== "pending") return [textMessage(MSG.alreadyDone)];
            return [question(id, draft, i)];

        case "types": {
            const mode = pb.m === "fix" ? "fix" : "pick";
            if (item?.state !== (mode === "fix" ? "saved" : "pending")) return [textMessage(MSG.alreadyDone)];
            const kind = pb.k === "income" ? "income" : "expense";
            return [categoryQuickReply({ draftId: id, index: i, item, kind, mode })];
        }

        case "cat": {
            if (item?.state !== "pending") return [textMessage(MSG.alreadyDone)];
            if (!isCategory(pb.c)) return [textMessage(MSG.badCategory)];
            const next = structuredClone(draft);
            const it = next.items[i];
            Object.assign(it, { category: pb.c, type: typeOf(pb.c), state: "saved", txId: store.newTxId() });
            const learn = learnOp(uid, it.note, pb.c, await store.getWords(uid));
            return apply(ctx, id, draft, next, { creates: [{ id: it.txId, data: txData(uid, it, next.date) }], learn }, () =>
                nextQuestion(id, next, today, MSG.savedOne(it.note))
            );
        }

        case "skip": {
            if (item?.state !== "pending") return [textMessage(MSG.alreadyDone)];
            const next = structuredClone(draft);
            next.items[i].state = "skipped";
            return apply(ctx, id, draft, next, {}, () => nextQuestion(id, next, today));
        }

        case "fix":
            if (i === null) {
                return draft.items.some((it) => it.state === "saved")
                    ? [fixItemsQuickReply(id, draft)]
                    : [textMessage(MSG.nothingSaved)];
            }
            if (item?.state !== "saved") return [textMessage(MSG.alreadyDone)];
            return [categoryQuickReply({ draftId: id, index: i, item, kind: item.type, mode: "fix" })];

        case "fixcat": {
            if (item?.state !== "saved") return [textMessage(MSG.alreadyDone)];
            if (!isCategory(pb.c)) return [textMessage(MSG.badCategory)];
            const next = structuredClone(draft);
            const it = next.items[i];
            Object.assign(it, { category: pb.c, type: typeOf(pb.c) });
            const learn = learnOp(uid, it.note, pb.c, await store.getWords(uid));
            const updates = [{ id: it.txId, data: { category: it.category, type: it.type } }];
            return apply(ctx, id, draft, next, { updates, learn }, (res) =>
                res.missing.length ? [textMessage(MSG.txGone)] : [summaryCard(id, next, today)]
            );
        }

        default:
            return [];
    }
}
