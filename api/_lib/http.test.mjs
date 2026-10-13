import { test } from "node:test";
import assert from "node:assert/strict";
import { json, redirect, safeReturnTo } from "./http.mjs";

test("safeReturnTo accepts internal paths only", () => {
    assert.equal(safeReturnTo("/settings"), "/settings");
    assert.equal(safeReturnTo("/dashboard?x=1"), "/dashboard?x=1");
    assert.equal(safeReturnTo("//evil.com"), null);
    assert.equal(safeReturnTo("/\\evil.com"), null);
    assert.equal(safeReturnTo("https://evil.com"), null);
    assert.equal(safeReturnTo(""), null);
    assert.equal(safeReturnTo(undefined), null);
    assert.equal(safeReturnTo("/\t/evil.com"), null);
    assert.equal(safeReturnTo("/\n/evil.com"), null);
    assert.equal(safeReturnTo("/foo\\bar"), null);
});

test("json sets status, content type and extra headers", async () => {
    const res = json({ ok: true }, 201, { "X-A": "1" });
    assert.equal(res.status, 201);
    assert.equal(res.headers.get("content-type"), "application/json");
    assert.equal(res.headers.get("x-a"), "1");
    assert.deepEqual(await res.json(), { ok: true });
});

test("redirect is a 302 with Location and extra headers", () => {
    const res = redirect("/x", { "Set-Cookie": "a=b" });
    assert.equal(res.status, 302);
    assert.equal(res.headers.get("location"), "/x");
    assert.equal(res.headers.get("set-cookie"), "a=b");
});
