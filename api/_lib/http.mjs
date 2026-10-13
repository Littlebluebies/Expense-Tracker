// ตัวช่วยสร้าง Response ของ Vercel Functions (Web standard Request/Response)

export const json = (data, status = 200, headers = {}) =>
    new Response(JSON.stringify(data), {
        status,
        headers: { "Content-Type": "application/json", ...headers },
    });

export const redirect = (location, headers = {}) =>
    new Response(null, { status: 302, headers: { Location: location, ...headers } });

// รับเฉพาะ path ในเว็บเรา ("/settings") กัน open redirect ไปเว็บอื่น ("//evil.com")
export const safeReturnTo = (value) =>
    typeof value === "string" && value.startsWith("/") && !value.startsWith("//") && !value.startsWith("/\\")
        ? value
        : null;
