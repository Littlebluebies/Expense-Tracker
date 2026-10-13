import { useEffect, useState } from "react";

const KEY = "theme";

// สีแถบสถานะของมือถือ ให้ตรงกับแถบหัวสีเขียวของแต่ละโหมด
const BAR_COLOR = { light: "#1f5e3d", dark: "#133a27" };

const readTheme = () => {
    try {
        const saved = localStorage.getItem(KEY);
        if (saved === "light" || saved === "dark") return saved;
    } catch {
        // localStorage ใช้ไม่ได้ (private mode ฯลฯ)
    }
    return window.matchMedia?.("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light";
};

export const applyTheme = (theme = readTheme()) => {
    document.documentElement.setAttribute("data-bs-theme", theme);
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", BAR_COLOR[theme]);
    return theme;
};

export function useTheme() {
    const [theme, setTheme] = useState(readTheme);

    useEffect(() => {
        applyTheme(theme);
        try {
            localStorage.setItem(KEY, theme);
        } catch {
            // ignore
        }
    }, [theme]);

    const toggle = () => setTheme((t) => (t === "dark" ? "light" : "dark"));
    return [theme, toggle];
}
