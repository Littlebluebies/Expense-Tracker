// lineUsage/{uid} = { day, dayCount, minute, minuteCount, warnedDay, warnedMinute, limitPerDay?, limitPerMinute? }
// เกินเกณฑ์ -> เตือนครั้งเดียวต่อช่วง แล้วเงียบ (ไม่ตอบ ไม่เขียน)
// next = null แปลว่าไม่ต้องเขียนอะไรกลับ
export function decideQuota(usage, { today, minute, limits }) {
    const next = { ...(usage || {}) };
    const perDay = next.limitPerDay ?? limits.perDay;
    const perMinute = next.limitPerMinute ?? limits.perMinute;

    if (next.day !== today) Object.assign(next, { day: today, dayCount: 0, warnedDay: false });
    if (next.minute !== minute) Object.assign(next, { minute, minuteCount: 0, warnedMinute: false });

    if (next.dayCount >= perDay) {
        if (next.warnedDay) return { decision: "silent", next: null };
        next.warnedDay = true;
        return { decision: "warnDay", next };
    }
    if (next.minuteCount >= perMinute) {
        if (next.warnedMinute) return { decision: "silent", next: null };
        next.warnedMinute = true;
        return { decision: "warnMinute", next };
    }
    next.dayCount += 1;
    next.minuteCount += 1;
    return { decision: "ok", next };
}
