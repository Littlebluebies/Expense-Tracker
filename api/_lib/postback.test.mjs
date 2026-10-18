import { test } from "node:test";
import assert from "node:assert/strict";
import { decodePostback, encodePostback } from "./postback.mjs";

test("postback data round-trips and drops empty fields", () => {
    const data = encodePostback({ a: "cat", d: "123456789012345678", i: 3, c: "food", v: undefined, k: null });
    assert.equal(data, "a=cat&d=123456789012345678&i=3&c=food");
    assert.deepEqual(decodePostback(data), { a: "cat", d: "123456789012345678", i: "3", c: "food" });
    assert.deepEqual(decodePostback(""), {});
});

test("postback data longer than LINE's 300 characters is refused", () => {
    assert.throws(() => encodePostback({ a: "x".repeat(400) }));
});
