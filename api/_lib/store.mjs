import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { decideQuota } from "./rateLimit.mjs";

// ที่เก็บข้อมูลของบอทบน Firestore (admin SDK) — interface เดียวกับ createFakeStore ใน testing/fakes.mjs
// ทุกอย่างที่ต้องเปลี่ยนพร้อมกันทำใน transaction เดียว (applyDraft, consumeQuota)
const ALREADY_EXISTS = 6;
const toDate = (v) => (v instanceof Timestamp ? v.toDate() : v);

export function createFirestoreStore(db) {
    const drafts = db.collection("lineDrafts");
    const txRef = (id) => db.collection("transactions").doc(id);

    return {
        async findLink(lineUserId) {
            const snap = await db.collection("lineLinks").doc(lineUserId).get();
            return snap.exists ? snap.data() : null;
        },

        async consumeQuota(uid, ctx) {
            const ref = db.collection("lineUsage").doc(uid);
            return db.runTransaction(async (tx) => {
                const snap = await tx.get(ref);
                const { decision, next } = decideQuota(snap.exists ? snap.data() : undefined, ctx);
                if (next) tx.set(ref, next);
                return decision;
            });
        },

        async getWords(uid) {
            const snap = await db.collection("lineDicts").doc(uid).get();
            return (snap.exists && snap.data().words) || {};
        },

        // ใช้ composite index lineDrafts: userId ASC, expiresAt ASC
        async deleteExpiredDrafts(uid, now) {
            const snap = await drafts.where("userId", "==", uid).where("expiresAt", "<=", now).limit(50).get();
            if (snap.empty) return;
            const batch = db.batch();
            snap.docs.forEach((d) => batch.delete(d.ref));
            await batch.commit();
        },

        async createDraft(id, draft) {
            try {
                await drafts.doc(id).create(draft);
                return true;
            } catch (err) {
                if (err.code === ALREADY_EXISTS) return false;
                throw err;
            }
        },

        async getDraft(id) {
            const snap = await drafts.doc(id).get();
            if (!snap.exists) return null;
            const d = snap.data();
            return { ...d, createdAt: toDate(d.createdAt), expiresAt: toDate(d.expiresAt) };
        },

        newTxId() {
            return db.collection("transactions").doc().id;
        },

        async applyDraft(id, expectedVersion, ops) {
            const ref = drafts.doc(id);
            return db.runTransaction(async (tx) => {
                // อ่านทั้งหมดก่อนเขียน (กฎของ Firestore transaction)
                const snap = await tx.get(ref);
                if (!snap.exists || snap.data().version !== expectedVersion) return { ok: false, missing: [] };
                const updateSnaps = ops.updates.length ? await tx.getAll(...ops.updates.map((u) => txRef(u.id))) : [];

                const missing = [];
                tx.set(ref, { ...ops.draft, version: expectedVersion + 1 });
                for (const c of ops.creates) tx.set(txRef(c.id), { ...c.data, createdAt: FieldValue.serverTimestamp() });
                updateSnaps.forEach((s, k) => {
                    if (s.exists) tx.update(s.ref, ops.updates[k].data);
                    else missing.push(ops.updates[k].id);
                });
                for (const txId of ops.deletes) tx.delete(txRef(txId));
                if (ops.learn) {
                    tx.set(
                        db.collection("lineDicts").doc(ops.learn.uid),
                        { words: { [ops.learn.word]: ops.learn.category } },
                        { merge: true }
                    );
                }
                return { ok: true, missing };
            });
        },

        // ใช้ composite index transactions: userId ASC, date ASC
        async monthTotals(uid, start, end) {
            const snap = await db
                .collection("transactions")
                .where("userId", "==", uid)
                .where("date", ">=", start)
                .where("date", "<", end)
                .get();
            let income = 0;
            let expense = 0;
            snap.forEach((d) => {
                const t = d.data();
                if (t.type === "income") income += t.amount;
                else expense += t.amount;
            });
            return { income, expense };
        },

        // เหมือน budgetFor ใน src/utils/useFinanceData.js
        async getBudget(uid, key) {
            const snap = await db.collection("budgets").doc(uid).get();
            if (!snap.exists) return 0;
            const b = snap.data();
            const m = b.monthly?.[key];
            return m !== undefined && m !== null ? Number(m) : Number(b.budget) || 0;
        },
    };
}
