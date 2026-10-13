import { test } from "node:test";
import assert from "node:assert/strict";
import {
    addDays, bangkokYmd, dateLabel, isValidYmd, minuteIndex, monthBounds, monthKey, monthLabel, noonBangkok, thaiShortDate, ymd,
} from "./thaiDate.mjs";

test("bangkokYmd flips the day at 17:00 UTC", () => {
    assert.equal(bangkokYmd(new Date("2026-10-13T16:59:59Z")), "2026-10-13");
    assert.equal(bangkokYmd(new Date("2026-10-13T17:00:00Z")), "2026-10-14");
    assert.equal(bangkokYmd(new Date("2026-12-31T17:30:00Z")), "2027-01-01");
});

test("addDays crosses months, leap days and years", () => {
    assert.equal(addDays("2026-03-01", -1), "2026-02-28");
    assert.equal(addDays("2024-03-01", -1), "2024-02-29");
    assert.equal(addDays("2026-01-01", -1), "2025-12-31");
    assert.equal(addDays("2026-10-14", -2), "2026-10-12");
});

test("isValidYmd and ymd", () => {
    assert.equal(isValidYmd(2026, 2, 29), false);
    assert.equal(isValidYmd(2024, 2, 29), true);
    assert.equal(isValidYmd(2026, 13, 1), false);
    assert.equal(isValidYmd(2026, 9, 31), false);
    assert.equal(isValidYmd(1800, 1, 1), false);
    assert.equal(ymd(2026, 3, 5), "2026-03-05");
});

test("noonBangkok matches the web's fromInputDate (12:00 local Thai time)", () => {
    assert.equal(noonBangkok("2026-10-14").toISOString(), "2026-10-14T05:00:00.000Z");
});

test("monthBounds covers the Thai calendar month", () => {
    const { start, end } = monthBounds("2026-12-15");
    assert.equal(start.toISOString(), "2026-11-30T17:00:00.000Z");
    assert.equal(end.toISOString(), "2026-12-31T17:00:00.000Z");
    assert.equal(monthKey("2026-12-15"), "2026-12");
});

test("minuteIndex counts whole minutes", () => {
    assert.equal(minuteIndex(new Date(120_000)), 2);
    assert.equal(minuteIndex(new Date(179_999)), 2);
});

test("Thai labels", () => {
    assert.equal(thaiShortDate("2026-10-13"), "13 ต.ค.");
    assert.equal(thaiShortDate("2025-12-31", true), "31 ธ.ค. 2568");
    assert.equal(dateLabel("2026-10-14", "2026-10-14"), "วันนี้ (14 ต.ค.)");
    assert.equal(dateLabel("2026-10-13", "2026-10-14"), "เมื่อวาน (13 ต.ค.)");
    assert.equal(dateLabel("2026-10-01", "2026-10-14"), "1 ต.ค.");
    assert.equal(dateLabel("2025-12-31", "2026-10-14"), "31 ธ.ค. 2568");
    assert.equal(monthLabel("2026-10-14"), "ต.ค. 2569");
});
