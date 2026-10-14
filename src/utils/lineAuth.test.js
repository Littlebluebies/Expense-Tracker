import { hasPassword, isRecentSignIn, lineErrorMessage, readLineHash, takeLoginNonce } from "./lineAuth";

test("lineErrorMessage maps known codes and falls back for unknown ones", () => {
    expect(lineErrorMessage("cancelled")).toBe("ยกเลิกการเข้าสู่ระบบด้วย LINE");
    expect(lineErrorMessage("expired")).toBe("ลิงก์หมดอายุ ลองใหม่อีกครั้ง");
    expect(lineErrorMessage("already_linked")).toBe("LINE นี้เชื่อมกับบัญชีอื่นอยู่แล้ว");
    expect(lineErrorMessage("weird")).toBe("เข้าสู่ระบบด้วย LINE ไม่สำเร็จ ลองใหม่อีกครั้ง");
    expect(lineErrorMessage(null)).toBe("");
});

test("readLineHash reads the token, the browser nonce and only a safe returnTo", () => {
    expect(readLineHash("#token=abc&returnTo=%2Fsettings&cn=n1")).toEqual({ token: "abc", returnTo: "/settings", cn: "n1" });
    expect(readLineHash("#token=abc")).toEqual({ token: "abc", returnTo: "/dashboard", cn: null });
    expect(readLineHash("#token=abc&returnTo=%2F%2Fevil.com")).toEqual({ token: "abc", returnTo: "/dashboard", cn: null });
    expect(readLineHash("#token=abc&returnTo=https%3A%2F%2Fevil.com")).toEqual({ token: "abc", returnTo: "/dashboard", cn: null });
    expect(readLineHash("#token=abc&returnTo=%2F%09%2Fevil.com")).toEqual({ token: "abc", returnTo: "/dashboard", cn: null });
    expect(readLineHash("")).toEqual({ token: null, returnTo: "/dashboard", cn: null });
});

describe("takeLoginNonce", () => {
    const NOW = 1_800_000_000_000;
    const memory = (value) => {
        const data = new Map(value === undefined ? [] : [["line_cn", value]]);
        return {
            data,
            getItem: (k) => (data.has(k) ? data.get(k) : null),
            removeItem: (k) => data.delete(k),
        };
    };
    const saved = (cn, exp = NOW + 60000) => JSON.stringify({ cn, exp });

    test("accepts the nonce this browser stored and removes it", () => {
        const storage = memory(saved("n1"));
        expect(takeLoginNonce(storage, "n1", NOW)).toBe(true);
        expect(storage.data.has("line_cn")).toBe(false);
    });

    test("rejects a different nonce and still removes the stored one", () => {
        const storage = memory(saved("n1"));
        expect(takeLoginNonce(storage, "n2", NOW)).toBe(false);
        expect(storage.data.has("line_cn")).toBe(false);
    });

    test("rejects a missing hash nonce or a missing stored nonce", () => {
        const storage = memory(saved("n1"));
        expect(takeLoginNonce(storage, null, NOW)).toBe(false);
        expect(storage.data.has("line_cn")).toBe(false);
        expect(takeLoginNonce(memory(), "n1", NOW)).toBe(false);
        expect(takeLoginNonce(memory("not json"), "n1", NOW)).toBe(false);
    });

    test("rejects an expired nonce", () => {
        expect(takeLoginNonce(memory(saved("n1", NOW - 1)), "n1", NOW)).toBe(false);
    });

    test("rejects when storage throws", () => {
        const broken = {
            getItem: () => {
                throw new Error("blocked");
            },
            removeItem: () => {
                throw new Error("blocked");
            },
        };
        expect(takeLoginNonce(broken, "n1", NOW)).toBe(false);
        expect(takeLoginNonce(undefined, "n1", NOW)).toBe(false);
    });
});

test("hasPassword is true only when the password provider is linked", () => {
    expect(hasPassword({ providerData: [{ providerId: "password" }] })).toBe(true);
    expect(hasPassword({ providerData: [] })).toBe(false);
    expect(hasPassword(null)).toBe(false);
});

test("isRecentSignIn uses a 4 minute window", () => {
    const tok = (auth, issued) => ({
        authTime: new Date(auth).toUTCString(),
        issuedAtTime: new Date(issued).toUTCString(),
    });
    expect(isRecentSignIn(tok("2026-10-14T04:57:00Z", "2026-10-14T05:00:00Z"))).toBe(true);
    expect(isRecentSignIn(tok("2026-10-14T04:55:00Z", "2026-10-14T05:00:00Z"))).toBe(false);
    expect(isRecentSignIn({})).toBe(false);
    expect(isRecentSignIn(undefined)).toBe(false);
});
