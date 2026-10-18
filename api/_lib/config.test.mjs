import { test } from "node:test";
import assert from "node:assert/strict";
import { readLimits } from "./config.mjs";

test("readLimits defaults to 20 per minute and 300 per day", () => {
    assert.deepEqual(readLimits({}), { perMinute: 20, perDay: 300 });
});

test("readLimits reads non-negative integers and ignores junk", () => {
    assert.deepEqual(readLimits({ LINE_LIMIT_PER_MINUTE: "5", LINE_LIMIT_PER_DAY: "0" }), { perMinute: 5, perDay: 0 });
    assert.deepEqual(readLimits({ LINE_LIMIT_PER_MINUTE: "abc", LINE_LIMIT_PER_DAY: "-1" }), { perMinute: 20, perDay: 300 });
});
