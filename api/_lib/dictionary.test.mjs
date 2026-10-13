import { test } from "node:test";
import assert from "node:assert/strict";
import { GLOBAL_WORDS, WORDS_BY_CATEGORY } from "./dictionary.mjs";
import { isCategory } from "./categories.mjs";

test("every word is stored in matching form (lowercase, no spaces)", () => {
    for (const word of Object.keys(GLOBAL_WORDS)) assert.equal(word, word.toLowerCase().replace(/\s+/g, ""), word);
});

test("every category key is real", () => {
    for (const key of Object.keys(WORDS_BY_CATEGORY)) assert.ok(isCategory(key), key);
});

test("no word is listed under two categories", () => {
    const all = Object.values(WORDS_BY_CATEGORY).flat();
    const dupes = all.filter((w, i) => all.indexOf(w) !== i);
    assert.deepEqual(dupes, []);
});
