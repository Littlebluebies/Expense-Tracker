import { useEffect, useState } from "react";

// true เมื่อหน้าจอตรงกับ media query (อัปเดตเองเมื่อหมุนจอ/ปรับขนาด)
export function useMediaQuery(query) {
    const [matches, setMatches] = useState(() => window.matchMedia?.(query).matches ?? false);

    useEffect(() => {
        const mql = window.matchMedia?.(query);
        if (!mql) return undefined;
        const update = () => setMatches(mql.matches);
        update();
        mql.addEventListener("change", update);
        return () => mql.removeEventListener("change", update);
    }, [query]);

    return matches;
}
