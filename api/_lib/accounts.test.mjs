import { test } from "node:test";
import assert from "node:assert/strict";
import { linkLineAccount, resolveLoginUser } from "./accounts.mjs";
import { fakeAuth, fakeDb } from "./testing/fakes.mjs";

const NOW = new Date("2026-10-14T05:00:00Z");

test("a linked LINE user signs into the linked account without creating anyone", async () => {
    const db = fakeDb();
    const auth = fakeAuth();
    db.data.set("lineLinks/U1", { userId: "existing", displayName: "Ann" });
    assert.equal(await resolveLoginUser({ lineUserId: "U1", name: "Ann" }, { auth, db, now: NOW }), "existing");
    assert.equal(auth.users.size, 0);
});

test("a new LINE user gets a Firebase account named after LINE and a link", async () => {
    const db = fakeDb();
    const auth = fakeAuth();
    const uid = await resolveLoginUser({ lineUserId: "U1", name: "Ann" }, { auth, db, now: NOW });
    assert.equal(uid, "uid1");
    assert.equal(auth.users.get("uid1").displayName, "Ann");
    assert.deepEqual(db.data.get("lineLinks/U1"), { userId: "uid1", displayName: "Ann", linkedAt: NOW });
});

test("an empty or very long LINE name still gives a usable display name", async () => {
    const auth = fakeAuth();
    await resolveLoginUser({ lineUserId: "U1", name: "" }, { auth, db: fakeDb(), now: NOW });
    await resolveLoginUser({ lineUserId: "U2", name: "ก".repeat(80) }, { auth, db: fakeDb(), now: NOW });
    assert.equal(auth.users.get("uid1").displayName, "ผู้ใช้ LINE");
    assert.equal(auth.users.get("uid2").displayName.length, 50);
});

test("if another login linked the same LINE first, the extra account is removed", async () => {
    const db = fakeDb();
    const auth = fakeAuth();
    db.hooks.beforeCreate = (path) => {
        if (path === "lineLinks/U1") db.data.set(path, { userId: "winner", displayName: "Ann" });
    };
    assert.equal(await resolveLoginUser({ lineUserId: "U1", name: "Ann" }, { auth, db, now: NOW }), "winner");
    assert.equal(auth.users.size, 0);
});

test("linking attaches a free LINE account to the signed-in user", async () => {
    const db = fakeDb();
    assert.equal(await linkLineAccount({ lineUserId: "U1", name: "Ann", uid: "u42" }, { db, now: NOW }), "linked");
    assert.deepEqual(db.data.get("lineLinks/U1"), { userId: "u42", displayName: "Ann", linkedAt: NOW });
});

test("linking the same LINE again to the same user is fine, to another user is refused", async () => {
    const db = fakeDb();
    db.data.set("lineLinks/U1", { userId: "u42", displayName: "Ann" });
    assert.equal(await linkLineAccount({ lineUserId: "U1", name: "Ann", uid: "u42" }, { db, now: NOW }), "linked");
    assert.equal(await linkLineAccount({ lineUserId: "U1", name: "Ann", uid: "u99" }, { db, now: NOW }), "already_linked");
    assert.equal(db.data.get("lineLinks/U1").userId, "u42");
});
