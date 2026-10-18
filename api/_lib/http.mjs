// ตัวช่วยสร้าง Response ของ Vercel Functions (Web standard Request/Response)

export const json = (data, status = 200, headers = {}) =>
    new Response(JSON.stringify(data), {
        status,
        headers: { "Content-Type": "application/json", ...headers },
    });

export const redirect = (location, headers = {}) =>
    new Response(null, { status: 302, headers: { Location: location, ...headers } });

// รับเฉพาะ path ในเว็บเรา ("/settings") กัน open redirect ไปเว็บอื่น ("//evil.com")
// ปฏิเสธ control character (U+0000–U+001F, U+007F) และ backslash ทุกตำแหน่ง
// เพราะ URL parser ของเบราว์เซอร์ตัด tab/newline ทิ้ง ("/\t/evil.com" กลายเป็น "//evil.com")
export const safeReturnTo = (value) =>
    typeof value === "string" && value.startsWith("/") && !value.startsWith("//") && !/[\u0000-\u001f\u007f\\]/.test(value)
        ? value
        : null;
