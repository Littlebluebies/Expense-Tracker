import { test } from "node:test";
import assert from "node:assert/strict";
import { openCookie, readCookie, sealCookie, stateCookieHeader } from "./cookie.mjs";

test("a sealed cookie opens before it expires", () => {
    const value = sealCookie({ state: "s", uid: null }, "key", 1000, 600);
    const data = openCookie(value, "key", 1000 + 599_000);
    assert.equal(data.state, "s");
    assert.equal(data.uid, null);
});

test("an expired cookie is rejected", () => {
    const value = sealCookie({ state: "s" }, "key", 1000, 600);
    assert.equal(openCookie(value, "key", 1000 + 600_001), null);
});

test("a tampered cookie or a different key is rejected", () => {
    const value = sealCookie({ state: "s" }, "key", 1000, 600);
    const [body, sig] = value.split(".");
    const forged = Buffer.from(JSON.stringify({ state: "evil", exp: 9e15 })).toString("base64url");
    assert.equal(openCookie(`${forged}.${sig}`, "key", 1000), null);
    assert.equal(openCookie(`${body}.${sig}x`, "key", 1000), null);
    assert.equal(openCookie(value, "other-key", 1000), null);
    assert.equal(openCookie("garbage", "key", 1000), null);
    assert.equal(openCookie(null, "key", 1000), null);
});

test("readCookie finds a cookie by name", () => {
    assert.equal(readCookie("a=1; line_oauth=x.y; b=2", "line_oauth"), "x.y");
    assert.equal(readCookie("a=1", "line_oauth"), null);
    assert.equal(readCookie(null, "line_oauth"), null);
});

test("the state cookie is HttpOnly, Secure, Lax and scoped to the LINE auth routes", () => {
    assert.equal(
        stateCookieHeader("v", 600),
        "line_oauth=v; Path=/api/auth/line; HttpOnly; Secure; SameSite=Lax; Max-Age=600"
    );
});
