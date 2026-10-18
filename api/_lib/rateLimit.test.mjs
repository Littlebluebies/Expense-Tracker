import { test } from "node:test";
import assert from "node:assert/strict";
import { decideQuota } from "./rateLimit.mjs";

const limits = { perMinute: 2, perDay: 3 };
const ctx = (minute, today = "2026-10-14") => ({ today, minute, limits });

function runMany(decisions, usage, contexts) {
    for (const c of contexts) {
        const { decision, next } = decideQuota(usage, c);
        decisions.push(decision);
        if (next) usage = next;
    }
    return usage;
}

test("counts per minute: warn once, then silent, then reset next minute", () => {
    const seen = [];
    runMany(seen, undefined, [ctx(1), ctx(1), ctx(1), ctx(1), ctx(2)]);
    assert.deepEqual(seen, ["ok", "ok", "warnMinute", "silent", "ok"]);
});

test("counts per day: warn once, then silent, then reset the next day", () => {
    const seen = [];
    runMany(seen, undefined, [ctx(1), ctx(2), ctx(3), ctx(4), ctx(5), ctx(6, "2026-10-15")]);
    assert.deepEqual(seen, ["ok", "ok", "ok", "warnDay", "silent", "ok"]);
});

test("silent decisions write nothing", () => {
    const usage = { day: "2026-10-14", dayCount: 3, minute: 9, minuteCount: 0, warnedDay: true, warnedMinute: false };
    assert.deepEqual(decideQuota(usage, ctx(9)), { decision: "silent", next: null });
});

test("per-user overrides beat the defaults; 0 suspends the bot", () => {
    assert.equal(decideQuota({ limitPerDay: 0 }, ctx(1)).decision, "warnDay");
    const { next } = decideQuota({ limitPerMinute: 1 }, ctx(1));
    assert.equal(decideQuota(next, ctx(1)).decision, "warnMinute");
    assert.equal(next.limitPerMinute, 1);
});
