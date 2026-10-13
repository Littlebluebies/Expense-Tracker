// ตัวปลอมสำหรับเทสต์ฝั่ง server (ไม่ถูก deploy เป็น function เพราะอยู่ใต้ _lib)

// fetch ปลอม: routes = { [url]: { status?, body } } และเก็บทุก request ไว้ใน .calls
export function fakeFetch(routes) {
    const calls = [];
    const fn = async (url, init = {}) => {
        calls.push({ url: String(url), init, body: init.body === undefined ? "" : String(init.body) });
        const route = routes[String(url)];
        if (!route) return new Response("not found", { status: 404 });
        const { status = 200, body } = route;
        return new Response(typeof body === "string" ? body : JSON.stringify(body), {
            status,
            headers: { "Content-Type": "application/json" },
        });
    };
    fn.calls = calls;
    return fn;
}
