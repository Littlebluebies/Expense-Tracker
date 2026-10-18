import { test } from "node:test";
import assert from "node:assert/strict";
import { CATEGORIES, EXPENSE, INCOME, categoryOf, isCategory, typeOf } from "./categories.mjs";
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES } from "../../src/constants/categories.js";

const pairs = (list) => list.map(({ key, label }) => [key, label]);

test("server categories match the web app's categories exactly", () => {
    assert.deepEqual(pairs(EXPENSE), pairs(EXPENSE_CATEGORIES));
    assert.deepEqual(pairs(INCOME), pairs(INCOME_CATEGORIES));
});

test("every LINE button label fits LINE's 20 character limit", () => {
    for (const c of CATEGORIES) assert.ok(c.short.length <= 20, `${c.key}: ${c.short}`);
});

test("lookups", () => {
    assert.equal(categoryOf("bills").short, "น้ำ/ไฟ/เน็ต/โทร");
    assert.equal(categoryOf("nope"), null);
    assert.equal(isCategory("salary"), true);
    assert.equal(isCategory("hacker"), false);
    assert.equal(typeOf("salary"), "income");
    assert.equal(typeOf("food"), "expense");
});
