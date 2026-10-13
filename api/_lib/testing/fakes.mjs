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

// Firestore ปลอมแบบย่อ: รองรับ collection().doc().get()/create() พอสำหรับ accounts
export function fakeDb() {
    const data = new Map();
    const hooks = {};
    const ref = (col, id) => {
        const path = `${col}/${id}`;
        return {
            id,
            path,
            async get() {
                const value = data.get(path);
                return { exists: value !== undefined, id, data: () => value };
            },
            async create(value) {
                hooks.beforeCreate?.(path);
                if (data.has(path)) {
                    const err = new Error("ALREADY_EXISTS");
                    err.code = 6;
                    throw err;
                }
                data.set(path, value);
            },
        };
    };
    return { data, hooks, collection: (col) => ({ doc: (id) => ref(col, id) }) };
}

// Firebase Auth ปลอม
export function fakeAuth() {
    let n = 0;
    const users = new Map();
    return {
        users,
        async createUser({ displayName }) {
            n += 1;
            const uid = `uid${n}`;
            users.set(uid, { uid, displayName });
            return { uid };
        },
        async deleteUser(uid) {
            users.delete(uid);
        },
        async createCustomToken(uid) {
            return `token-for-${uid}`;
        },
        async verifyIdToken(token) {
            if (typeof token === "string" && token.startsWith("id-")) return { uid: token.slice(3) };
            throw new Error("invalid token");
        },
    };
}
