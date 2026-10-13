import { hasPassword, isRecentSignIn, lineErrorMessage, readLineHash } from "./lineAuth";

test("lineErrorMessage maps known codes and falls back for unknown ones", () => {
    expect(lineErrorMessage("cancelled")).toBe("ยกเลิกการเข้าสู่ระบบด้วย LINE");
    expect(lineErrorMessage("expired")).toBe("ลิงก์หมดอายุ ลองใหม่อีกครั้ง");
    expect(lineErrorMessage("already_linked")).toBe("LINE นี้เชื่อมกับบัญชีอื่นอยู่แล้ว");
    expect(lineErrorMessage("weird")).toBe("เข้าสู่ระบบด้วย LINE ไม่สำเร็จ ลองใหม่อีกครั้ง");
    expect(lineErrorMessage(null)).toBe("");
});

test("readLineHash reads the token and only a safe returnTo", () => {
    expect(readLineHash("#token=abc&returnTo=%2Fsettings")).toEqual({ token: "abc", returnTo: "/settings" });
    expect(readLineHash("#token=abc")).toEqual({ token: "abc", returnTo: "/dashboard" });
    expect(readLineHash("#token=abc&returnTo=%2F%2Fevil.com")).toEqual({ token: "abc", returnTo: "/dashboard" });
    expect(readLineHash("#token=abc&returnTo=https%3A%2F%2Fevil.com")).toEqual({ token: "abc", returnTo: "/dashboard" });
    expect(readLineHash("#token=abc&returnTo=%2F%09%2Fevil.com")).toEqual({ token: "abc", returnTo: "/dashboard" });
    expect(readLineHash("")).toEqual({ token: null, returnTo: "/dashboard" });
});

test("hasPassword is true only when the password provider is linked", () => {
    expect(hasPassword({ providerData: [{ providerId: "password" }] })).toBe(true);
    expect(hasPassword({ providerData: [] })).toBe(false);
    expect(hasPassword(null)).toBe(false);
});

test("isRecentSignIn uses a 4 minute window", () => {
    const now = Date.parse("2026-10-14T05:00:00Z");
    const at = (iso) => ({ metadata: { lastSignInTime: new Date(iso).toUTCString() } });
    expect(isRecentSignIn(at("2026-10-14T04:57:00Z"), now)).toBe(true);
    expect(isRecentSignIn(at("2026-10-14T04:55:00Z"), now)).toBe(false);
    expect(isRecentSignIn({}, now)).toBe(false);
});
