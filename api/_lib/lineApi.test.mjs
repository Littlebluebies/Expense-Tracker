import { test } from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { replyMessage, verifySignature } from "./lineApi.mjs";
import { fakeFetch } from "./testing/fakes.mjs";

const REPLY = "https://api.line.me/v2/bot/message/reply";
const sign = (body, secret) => createHmac("sha256", secret).update(body).digest("base64");

test("verifySignature accepts LINE's HMAC and rejects anything else", () => {
    const body = Buffer.from('{"events":[{"message":{"text":"ค่าข้าว 50"}}]}');
    assert.equal(verifySignature(body, sign(body, "sec"), "sec"), true);
    assert.equal(verifySignature(body, sign(body, "other"), "sec"), false);
    assert.equal(verifySignature(Buffer.from("{}"), sign(body, "sec"), "sec"), false);
    assert.equal(verifySignature(body, null, "sec"), false);
    assert.equal(verifySignature(body, "short", "sec"), false);
});

test("replyMessage posts JSON with the bearer token and skips empty replies", async () => {
    const f = fakeFetch({ [REPLY]: { body: {} } });
    await replyMessage("rt", [], "tok", f);
    assert.equal(f.calls.length, 0);
    await replyMessage("rt", [{ type: "text", text: "hi" }], "tok", f);
    assert.equal(f.calls[0].init.method, "POST");
    assert.equal(f.calls[0].init.headers.Authorization, "Bearer tok");
    assert.equal(f.calls[0].init.headers["Content-Type"], "application/json");
    assert.deepEqual(JSON.parse(f.calls[0].body), { replyToken: "rt", messages: [{ type: "text", text: "hi" }] });
});

test("replyMessage throws when LINE rejects the reply", async () => {
    const f = fakeFetch({ [REPLY]: { status: 400, body: { message: "Invalid reply token" } } });
    await assert.rejects(replyMessage("rt", [{ type: "text", text: "hi" }], "tok", f), /400/);
});
