import { test } from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { createWebhookHandler } from "./webhookRoute.mjs";
import { createFakeStore, fakeFetch } from "./testing/fakes.mjs";

const SECRET = "sec";
const REPLY = "https://api.line.me/v2/bot/message/reply";
const NOW = new Date("2026-10-14T05:00:00Z");
const sign = (body) => createHmac("sha256", SECRET).update(body).digest("base64");
const request = (body, signature = sign(body)) =>
    new Request("https://app.test/api/line/webhook", { method: "POST", headers: { "x-line-signature": signature }, body });
const handler = (store, fetchImpl) =>
    createWebhookHandler({ channelSecret: SECRET, accessToken: "tok", store, limits: { perMinute: 20, perDay: 300 }, fetchImpl, clock: () => NOW });
const textEvent = (userId, text, replyToken = "r1") => ({
    type: "message",
    replyToken,
    source: { type: "user", userId },
    message: { type: "text", id: `id-${replyToken}`, text },
});

test("an invalid signature is rejected with 401 and nothing is processed", async () => {
    const store = createFakeStore();
    const f = fakeFetch({ [REPLY]: { body: {} } });
    const body = JSON.stringify({ events: [textEvent("U1", "ค่าข้าว 50")] });
    const res = await handler(store, f)(request(body, sign("something else")));
    assert.equal(res.status, 401);
    assert.equal(f.calls.length, 0);
});

test("LINE's webhook verification (no events) gets 200 without a reply", async () => {
    const f = fakeFetch({ [REPLY]: { body: {} } });
    const res = await handler(createFakeStore(), f)(request(JSON.stringify({ destination: "x", events: [] })));
    assert.equal(res.status, 200);
    assert.equal(f.calls.length, 0);
});

test("each event is answered through the reply API with its own token, using the request origin for links", async () => {
    const f = fakeFetch({ [REPLY]: { body: {} } });
    const body = JSON.stringify({ events: [textEvent("U9", "ค่าข้าว 50", "r1"), textEvent("U9", "สวัสดี", "r2")] });
    const res = await handler(createFakeStore(), f)(request(body));
    assert.equal(res.status, 200);
    assert.deepEqual(f.calls.map((c) => JSON.parse(c.body).replyToken), ["r1", "r2"]);
    assert.match(f.calls[0].body, /https:\/\/app\.test\//);
});

test("Thai text survives the raw-body signature check", async () => {
    const store = createFakeStore({ links: { U1: { userId: "u1" } } });
    const f = fakeFetch({ [REPLY]: { body: {} } });
    await handler(store, f)(request(JSON.stringify({ events: [textEvent("U1", "ค่าข้าวตอนกลางวัน 50 บาท")] })));
    assert.equal(store.drafts.get("id-r1").items[0].note, "ค่าข้าวตอนกลางวัน");
});

test("when an event fails the user gets the system error and LINE still gets 200", async () => {
    const store = createFakeStore();
    store.findLink = async () => {
        throw new Error("db down");
    };
    const f = fakeFetch({ [REPLY]: { body: {} } });
    const res = await handler(store, f)(request(JSON.stringify({ events: [textEvent("U1", "ค่าข้าว 50")] })));
    assert.equal(res.status, 200);
    assert.match(f.calls[0].body, /ระบบขัดข้อง/);
});

test("a failed reply after a committed save is not followed by a second, misleading system-error reply", async () => {
    const store = createFakeStore({ links: { U1: { userId: "u1" } } });
    const f = fakeFetch({ [REPLY]: { status: 400, body: { message: "Invalid reply token" } } });
    const res = await handler(store, f)(request(JSON.stringify({ events: [textEvent("U1", "เมื่อวาน ค่าข้าว 50")] })));
    assert.equal(res.status, 200);
    assert.equal(f.calls.filter((c) => c.url === REPLY).length, 1);
    assert.doesNotMatch(f.calls[0].body, /ระบบขัดข้อง/);
    assert.equal(store.txs.size, 1);
    assert.equal([...store.txs.values()][0].note, "ค่าข้าว");
});

test("events without a reply token are processed but never replied to", async () => {
    const f = fakeFetch({ [REPLY]: { body: {} } });
    const { replyToken, ...noToken } = textEvent("U1", "ค่าข้าว 50");
    const res = await handler(createFakeStore(), f)(request(JSON.stringify({ events: [noToken] })));
    assert.equal(res.status, 200);
    assert.equal(f.calls.length, 0);
});

test("a body that is not JSON gets 400", async () => {
    const res = await handler(createFakeStore(), fakeFetch({}))(request("not json"));
    assert.equal(res.status, 400);
});
