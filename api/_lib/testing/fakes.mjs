import { decideQuota } from "../rateLimit.mjs";
// ตัวปลอมสำหรับเทสต์ฝั่ง server (ไม่ถูก deploy เป็น function เพราะอยู่ใต้ _lib)

// fetch ปลอม: routes = { [url]: { status?, body } } และเก็บทุก request ไว้ใน .calls
export function fakeFetch(routes) {
    const calls = [];
    const fn = async (url, init = {}) => {
        calls.push({ url: String(url), init, body: init.body === undefined ? "" : String(init.body) });
        const route = routes[String(url)];
        if (!route) return new Response("not found", { status: 404 });
        const { status = 200, body } = route;
        return new Response(typeof body === "string" ? body : JSON.stringify(body), {
            status,
            headers: { "Content-Type": "application/json" },
        });
    };
    fn.calls = calls;
    return fn;
}

// Firestore ปลอมแบบย่อ: รองรับ collection().doc().get()/create() พอสำหรับ accounts
export function fakeDb() {
    const data = new Map();
    const hooks = {};
    const ref = (col, id) => {
        const path = `${col}/${id}`;
        return {
            id,
            path,
            async get() {
                const value = data.get(path);
                return { exists: value !== undefined, id, data: () => value };
            },
            async create(value) {
                hooks.beforeCreate?.(path);
                if (data.has(path)) {
                    const err = new Error("ALREADY_EXISTS");
                    err.code = 6;
                    throw err;
                }
                data.set(path, value);
            },
        };
    };
    return { data, hooks, collection: (col) => ({ doc: (id) => ref(col, id) }) };
}

// Firebase Auth ปลอม
export function fakeAuth() {
    let n = 0;
    const users = new Map();
    const verifyCalls = [];
    return {
        users,
        verifyCalls,
        async createUser({ displayName }) {
            n += 1;
            const uid = `uid${n}`;
            users.set(uid, { uid, displayName });
            return { uid };
        },
        async deleteUser(uid) {
            users.delete(uid);
        },
        async createCustomToken(uid) {
            return `token-for-${uid}`;
        },
        // "id-<uid>" = เพิ่ง login, "old-<uid>" = login มา 10 นาทีแล้ว
        async verifyIdToken(token, checkRevoked) {
            verifyCalls.push({ token, checkRevoked });
            const nowSec = Math.floor(Date.now() / 1000);
            if (typeof token === "string" && token.startsWith("id-")) return { uid: token.slice(3), auth_time: nowSec };
            if (typeof token === "string" && token.startsWith("old-")) return { uid: token.slice(4), auth_time: nowSec - 600 };
            throw new Error("invalid token");
        },
    };
}

// ที่เก็บข้อมูลปลอมของบอท (interface เดียวกับ store.mjs) เปิดให้เทสต์ดู/แก้ข้างในได้
export function createFakeStore({ links = {}, words = {}, budgets = {} } = {}) {
    let n = 0;
    const s = {
        links: { ...links },
        words: structuredClone(words),
        budgets: { ...budgets },
        drafts: new Map(),
        txs: new Map(),
        usage: new Map(),
        quotaCalls: 0,
        failNextApply: false,
        async findLink(lineUserId) {
            return s.links[lineUserId] || null;
        },
        async consumeQuota(uid, ctx) {
            s.quotaCalls += 1;
            const { decision, next } = decideQuota(s.usage.get(uid), ctx);
            if (next) s.usage.set(uid, next);
            return decision;
        },
        async getWords(uid) {
            return { ...(s.words[uid] || {}) };
        },
        async deleteExpiredDrafts(uid, now) {
            for (const [id, d] of s.drafts) if (d.userId === uid && d.expiresAt <= now) s.drafts.delete(id);
        },
        async createDraft(id, draft) {
            if (s.drafts.has(id)) return false;
            s.drafts.set(id, structuredClone(draft));
            return true;
        },
        async getDraft(id) {
            const d = s.drafts.get(id);
            return d ? structuredClone(d) : null;
        },
        newTxId() {
            n += 1;
            return `tx${n}`;
        },
        async applyDraft(id, expectedVersion, ops) {
            const current = s.drafts.get(id);
            if (s.failNextApply || !current || current.version !== expectedVersion) {
                s.failNextApply = false;
                return { ok: false, missing: [] };
            }
            const missing = [];
            s.drafts.set(id, { ...structuredClone(ops.draft), version: expectedVersion + 1 });
            for (const c of ops.creates) s.txs.set(c.id, { ...c.data, createdAt: "server" });
            for (const u of ops.updates) {
                if (s.txs.has(u.id)) s.txs.set(u.id, { ...s.txs.get(u.id), ...u.data });
                else missing.push(u.id);
            }
            for (const txId of ops.deletes) s.txs.delete(txId);
            if (ops.learn) s.words[ops.learn.uid] = { ...(s.words[ops.learn.uid] || {}), [ops.learn.word]: ops.learn.category };
            return { ok: true, missing };
        },
        async monthTotals(uid, start, end) {
            let income = 0;
            let expense = 0;
            for (const t of s.txs.values()) {
                if (t.userId !== uid || t.date < start || t.date >= end) continue;
                if (t.type === "income") income += t.amount;
                else expense += t.amount;
            }
            return { income, expense };
        },
        async getBudget(uid, key) {
            const b = s.budgets[uid];
            if (!b) return 0;
            const m = b.monthly?.[key];
            return m !== undefined && m !== null ? Number(m) : Number(b.budget) || 0;
        },
    };
    return s;
}
