import { test } from "node:test";
import assert from "node:assert/strict";
import { createCallbackHandler, createStartHandler } from "./authRoutes.mjs";
import { openCookie } from "./cookie.mjs";
import { fakeAuth, fakeDb, fakeFetch } from "./testing/fakes.mjs";

const SECRET = "cookie-secret";
const ORIGIN = "https://app.test";
const TOKEN_URL = "https://api.line.me/oauth2/v2.1/token";
const VERIFY_URL = "https://api.line.me/oauth2/v2.1/verify";

function setup({ token = { body: { id_token: "idt" } }, verify = { body: { sub: "Uline1", name: "Ann" } } } = {}) {
    let n = 0;
    const auth = fakeAuth();
    const db = fakeDb();
    const fetchImpl = fakeFetch({ [TOKEN_URL]: token, [VERIFY_URL]: verify });
    const start = createStartHandler({ auth, cookieSecret: SECRET, channelId: "123", random: () => `r${++n}` });
    const callback = createCallbackHandler({ auth, db, cookieSecret: SECRET, channelId: "123", channelSecret: "sec", fetchImpl });
    return { auth, db, fetchImpl, start, callback };
}

const startReq = (body, headers = {}) =>
    new Request(`${ORIGIN}/api/auth/line/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...headers },
        body: JSON.stringify(body),
    });
const cbReq = (query, cookie) =>
    new Request(`${ORIGIN}/api/auth/line/callback?${new URLSearchParams(query)}`, {
        headers: cookie ? { cookie: `line_oauth=${cookie}` } : {},
    });
const cookieOf = (res) => res.headers.get("set-cookie").split(";")[0].slice("line_oauth=".length);
const withoutExp = ({ exp, ...rest }) => rest;
const begin = async (t, body = { mode: "login" }, headers) => cookieOf(await t.start(startReq(body, headers)));

test("start (login) returns the LINE URL and a sealed HttpOnly state cookie", async () => {
    const { start } = setup();
    const res = await start(startReq({ mode: "login" }));
    const url = new URL((await res.json()).url);
    assert.equal(url.origin + url.pathname, "https://access.line.me/oauth2/v2.1/authorize");
    assert.equal(url.searchParams.get("client_id"), "123");
    assert.equal(url.searchParams.get("redirect_uri"), `${ORIGIN}/api/auth/line/callback`);
    assert.equal(url.searchParams.get("state"), "r1");
    assert.equal(url.searchParams.get("nonce"), "r2");
    assert.match(res.headers.get("set-cookie"), /HttpOnly; Secure; SameSite=Lax; Max-Age=600/);
    assert.equal(res.headers.get("cache-control"), "no-store");
    assert.deepEqual(withoutExp(openCookie(cookieOf(res), SECRET)), {
        state: "r1",
        nonce: "r2",
        mode: "login",
        uid: null,
        returnTo: "/dashboard",
    });
});

test("start (link) requires a valid Firebase ID token and remembers the uid", async () => {
    const { start } = setup();
    assert.equal((await start(startReq({ mode: "link" }))).status, 401);
    assert.equal((await start(startReq({ mode: "link" }, { Authorization: "Bearer nope" }))).status, 401);
    const res = await start(startReq({ mode: "link" }, { Authorization: "Bearer id-u42" }));
    const saved = openCookie(cookieOf(res), SECRET);
    assert.equal(saved.mode, "link");
    assert.equal(saved.uid, "u42");
    assert.equal(saved.returnTo, "/settings");
});

test("start (link) requires a sign-in from the last 5 minutes and checks revocation", async () => {
    const { auth, start } = setup();
    const stale = await start(startReq({ mode: "link" }, { Authorization: "Bearer old-u42" }));
    assert.equal(stale.status, 401);
    assert.deepEqual(await stale.json(), { error: "reauth_required" });
    assert.equal(stale.headers.get("set-cookie"), null);
    const fresh = await start(startReq({ mode: "link" }, { Authorization: "Bearer id-u42" }));
    assert.equal(fresh.status, 200);
    assert.ok(auth.verifyCalls.length >= 2);
    for (const call of auth.verifyCalls) assert.equal(call.checkRevoked, true);
});

test("start (link) treats a token without auth_time as stale", async () => {
    const auth = fakeAuth();
    auth.verifyIdToken = async () => ({ uid: "u42" });
    const start = createStartHandler({ auth, cookieSecret: SECRET, channelId: "123" });
    const res = await start(startReq({ mode: "link" }, { Authorization: "Bearer id-u42" }));
    assert.equal(res.status, 401);
    assert.equal(res.headers.get("set-cookie"), null);
});

test("start (link) measures the sign-in age with the injected clock", async () => {
    const auth = fakeAuth();
    auth.verifyIdToken = async () => ({ uid: "u42", auth_time: 1_000_000 });
    const at = (sec) => createStartHandler({ auth, cookieSecret: SECRET, channelId: "123", now: () => sec * 1000 });
    const req = () => startReq({ mode: "link" }, { Authorization: "Bearer id-u42" });
    assert.equal((await at(1_000_300)(req())).status, 200);
    assert.equal((await at(1_000_301)(req())).status, 401);
});

test("start keeps safe returnTo values and drops unsafe ones", async () => {
    const { start } = setup();
    const keep = openCookie(cookieOf(await start(startReq({ mode: "login", returnTo: "/settings" }))), SECRET);
    const drop = openCookie(cookieOf(await start(startReq({ mode: "login", returnTo: "//evil.com" }))), SECRET);
    assert.equal(keep.returnTo, "/settings");
    assert.equal(drop.returnTo, "/dashboard");
});

test("start treats a missing or broken body as a login", async () => {
    const { start } = setup();
    const res = await start(new Request(`${ORIGIN}/api/auth/line/start`, { method: "POST", body: "not json" }));
    assert.equal(res.status, 200);
    assert.equal(openCookie(cookieOf(res), SECRET).mode, "login");
});

test("callback without a state cookie is treated as expired", async () => {
    const t = setup();
    const res = await t.callback(cbReq({ code: "c", state: "r1" }));
    assert.equal(res.status, 302);
    assert.equal(res.headers.get("location"), "/?line_error=expired");
});

test("callback reports a cancelled consent screen in both modes", async () => {
    const t = setup();
    const cookie = await begin(t);
    assert.equal((await t.callback(cbReq({ error: "ACCESS_DENIED", state: "r1" }, cookie))).headers.get("location"), "/?line_error=cancelled");
    const t2 = setup();
    const linkCookie = await begin(t2, { mode: "link" }, { Authorization: "Bearer id-u42" });
    assert.equal((await t2.callback(cbReq({ error: "access_denied" }, linkCookie))).headers.get("location"), "/settings?line_error=cancelled");
});

test("callback rejects a state that does not match the cookie", async () => {
    const t = setup();
    const cookie = await begin(t);
    assert.equal((await t.callback(cbReq({ code: "c", state: "other" }, cookie))).headers.get("location"), "/?line_error=expired");
    assert.equal(t.fetchImpl.calls.length, 0);
});

test("callback login creates the account, issues a custom token and clears the cookie", async () => {
    const t = setup();
    const cookie = await begin(t);
    const res = await t.callback(cbReq({ code: "c", state: "r1" }, cookie));
    assert.equal(res.status, 302);
    assert.equal(res.headers.get("location"), "/auth/line#token=token-for-uid1&returnTo=%2Fdashboard");
    assert.match(res.headers.get("set-cookie"), /^line_oauth=; .*Max-Age=0$/);
    assert.equal(t.db.data.get("lineLinks/Uline1").userId, "uid1");
    const verify = new URLSearchParams(t.fetchImpl.calls.find((c) => c.url === VERIFY_URL).body);
    assert.equal(verify.get("nonce"), "r2");
    const token = new URLSearchParams(t.fetchImpl.calls.find((c) => c.url === TOKEN_URL).body);
    assert.equal(token.get("redirect_uri"), `${ORIGIN}/api/auth/line/callback`);
});

test("callback link mode links LINE to the signed-in user", async () => {
    const t = setup();
    const cookie = await begin(t, { mode: "link" }, { Authorization: "Bearer id-u42" });
    const res = await t.callback(cbReq({ code: "c", state: "r1" }, cookie));
    assert.equal(res.headers.get("location"), "/settings?line=linked");
    assert.equal(t.db.data.get("lineLinks/Uline1").userId, "u42");
    assert.equal(t.auth.users.size, 0);
});

test("callback link mode refuses a LINE account already linked elsewhere", async () => {
    const t = setup();
    t.db.data.set("lineLinks/Uline1", { userId: "someone-else", displayName: "Ann" });
    const cookie = await begin(t, { mode: "link" }, { Authorization: "Bearer id-u42" });
    const res = await t.callback(cbReq({ code: "c", state: "r1" }, cookie));
    assert.equal(res.headers.get("location"), "/settings?line_error=already_linked");
    assert.equal(t.db.data.get("lineLinks/Uline1").userId, "someone-else");
});

test("callback reports failure when LINE rejects the code or the token", async () => {
    const t = setup({ token: { status: 400, body: { error: "invalid_grant" } } });
    assert.equal((await t.callback(cbReq({ code: "c", state: "r1" }, await begin(t)))).headers.get("location"), "/?line_error=failed");
    const t2 = setup({ verify: { status: 400, body: { error: "invalid_request" } } });
    assert.equal((await t2.callback(cbReq({ code: "c", state: "r1" }, await begin(t2)))).headers.get("location"), "/?line_error=failed");
    assert.equal(t2.auth.users.size, 0);
});
