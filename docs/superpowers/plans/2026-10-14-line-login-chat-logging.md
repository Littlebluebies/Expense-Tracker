# LINE Login และการจดรายการผ่านแชท LINE — แผนการลงมือ

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** เพิ่ม LINE Login (ใช้คู่กับอีเมล) และบอท LINE ที่แยกข้อความเป็นรายการ ใส่หมวดเอง ถามวันก่อนบันทึก และเขียนลง Firestore ชุดเดียวกับเว็บ

**Architecture:** ฝั่ง server เป็น Vercel Functions แบบ ESM (`.mjs`) ในโฟลเดอร์ `api/` ตรรกะทั้งหมดอยู่ใน `api/_lib/` เป็นโมดูลเล็ก ๆ ที่รับ dependency เป็นพารามิเตอร์ จึงเทสต์ด้วย `node --test` ได้โดยไม่ต้องต่อเน็ตหรือ Firestore จริง ไฟล์ใน `api/` ที่เป็น endpoint จริงมีหน้าที่แค่ประกอบ dependency จริงเข้าด้วยกัน ฝั่งเว็บ (CRA) เพิ่มปุ่ม LINE, หน้า `/auth/line` และส่วน LINE ในหน้าตั้งค่า

**Tech Stack:** Node 24 (Vercel ค่าเริ่มต้น) · `firebase-admin@^14.5.0` (ต้องใช้ Node ≥ 22) · `node:test` · LINE Login v2.1 · LINE Messaging API (reply เท่านั้น) · React 19 / CRA / Jest (ของเดิม)

**Spec:** `docs/superpowers/specs/2026-10-14-line-login-chat-logging-design.md`

## Global Constraints

- ต้องฟรีทั้งหมด: Firebase Spark, Vercel Hobby, LINE ใช้แค่ **reply** ห้ามใช้ push/multicast/broadcast
- โค้ด server เป็น ESM นามสกุล `.mjs` อยู่ใต้ `api/` ไฟล์ช่วยอยู่ใต้ `api/_lib/` (Vercel ไม่ทำโฟลเดอร์ที่ขึ้นต้นด้วย `_` เป็น function)
- เทสต์ server รันด้วย `npm run test:server` (`node --test`) ส่วนเทสต์เว็บรันด้วย `CI=true npm test -- --watchAll=false` (Jest ของ CRA) ห้ามเพิ่ม dependency สำหรับเทสต์
- dependency ใหม่มีตัวเดียวคือ `firebase-admin` ฝั่งเว็บไม่เพิ่ม dependency
- `transactions` ใช้ field เดิมทุกตัว: `userId, amount, type, category, date, note, createdAt` โดย `date` = เที่ยงวันเวลาไทยของวันนั้น (`YYYY-MM-DDT12:00:00+07:00`) ห้ามเพิ่ม field
- คอลเลกชันใหม่ใช้ field `userId`: `lineLinks/{lineUserId}`, `lineDicts/{uid}`, `lineDrafts/{messageId}`, `lineUsage/{uid}`
- ขีดจำกัด:
  - ข้อความหนึ่งมีได้ไม่เกิน **10 รายการ**
  - จำนวนเงิน `0 < x ≤ 1,000,000,000`
  - คำอธิบายไม่เกิน 100 ตัวอักษร
  - คำที่จำได้ยาวไม่เกิน 30 ตัวอักษร และพจนานุกรมส่วนตัวมีได้ไม่เกิน 500 คำ
  - รายการที่ค้างอยู่หมดอายุใน 7 วัน
  - quick reply มีได้ไม่เกิน 13 ปุ่ม ป้ายปุ่มยาวไม่เกิน 20 ตัวอักษร
  - postback data ยาวไม่เกิน 300 ตัวอักษร
  - จำกัดการใช้งานเริ่มต้นที่ 20 ครั้งต่อนาที และ 300 ครั้งต่อวัน
- "วันนี้" ทุกที่ในฝั่ง server คิดตามเวลา Asia/Bangkok (UTC+7)
- ข้อความที่ผู้ใช้เห็นเป็นภาษาไทยที่อ่านง่าย สกุลเงินบาท
- `CI=true npm run build` ต้องผ่าน (ถ้ามี ESLint warning ถือว่า build พัง)
- Bootstrap ยังเป็นฐานเหมือนเดิม และตัวหนังสือบนปุ่ม LINE ต้องมี contrast อย่างน้อย 4.5:1
- **ลำดับการ deploy:** ต้องวาง `firestore.rules` ใหม่ใน Firebase Console **ก่อน** deploy Task 7 ขึ้นไป ไม่อย่างนั้นการลบบัญชีจะเจอ `permission-denied`
- commit ทุกครั้งต้องปิดท้ายด้วยบรรทัด `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`

## Review Focus

1. **มีคำอธิบายท้ายข้อความแต่ไม่มีจำนวนเงิน** เช่น `ค่าข้าว 50 ค่าน้ำ` ผู้ใช้ต้องรู้ว่า "ค่าน้ำ" ไม่ได้ถูกบันทึก ระบบจึงเก็บไว้ใน `ignored` แล้วแสดงในการ์ด → เทสต์อยู่ใน Task 9 (parse) และ Task 11 (การ์ด)
2. **ข้อความที่ไม่ใช่ text** (สติกเกอร์ รูป) **หรือ event ที่ไม่มี replyToken** ระบบต้องเงียบ ไม่อ่านฐานข้อมูล ไม่นับโควตา และไม่ crash → Task 12
3. **postback ที่อ้างรายการของคนอื่น หรือส่ง key หมวดที่ไม่มีอยู่จริงมา** ระบบต้องไม่เขียนอะไรเลย → Task 13
4. **วันที่จาก datetimepicker ที่เป็นอนาคตหรือรูปแบบผิด** ระบบต้องปฏิเสธและไม่บันทึก เพราะค่า `max` บังคับได้แค่ฝั่งแอป LINE → Task 13
5. **ผู้ใช้ LINE อย่างเดียวที่ login มานานกว่า 4 นาทีแล้วกดลบบัญชี** ห้ามลบข้อมูลใด ๆ ก่อนยืนยันตัวตนใหม่ ไม่อย่างนั้นข้อมูลจะหายไปแต่บัญชียังอยู่ → Task 5 (`isRecentSignIn`) และ Task 7

---

## โครงสร้างไฟล์

```
api/
  auth/line/start.mjs          POST: สร้าง URL ไป LINE + cookie state
  auth/line/callback.mjs       GET: ตรวจ state/ID token, หา/สร้าง/ผูกบัญชี, redirect
  line/webhook.mjs             POST: ตรวจลายเซ็น, ส่ง event ให้ bot, ตอบกลับ
  _lib/
    http.mjs                   json(), redirect(), safeReturnTo()
    config.mjs                 อ่าน env (config.*, readLimits)
    firebaseAdmin.mjs          adminAuth(), adminDb()
    cookie.mjs                 cookie ที่ลงลายเซ็น HMAC
    lineOAuth.mjs              authorizeUrl, exchangeCode, verifyIdToken, randomToken
    accounts.mjs               resolveLoginUser, linkLineAccount
    authRoutes.mjs             createStartHandler, createCallbackHandler
    categories.mjs             หมวด + ชื่อสั้นสำหรับ LINE
    thaiDate.mjs               วันที่ตามเวลาไทย
    dictionary.mjs             พจนานุกรมกลาง
    parse.mjs                  parseMessage, matchCategory, learnKey
    postback.mjs               encodePostback, decodePostback
    rateLimit.mjs              decideQuota
    messages.mjs               ข้อความ/การ์ด/quick reply ของ LINE
    bot.mjs                    handleEvent (ตรรกะบอททั้งหมด)
    store.mjs                  createFirestoreStore (ที่เก็บจริง)
    lineApi.mjs                verifySignature, replyMessage
    webhookRoute.mjs           createWebhookHandler
    testing/fakes.mjs          fakeFetch, fakeDb, fakeAuth, createFakeStore
    *.test.mjs                 เทสต์ของแต่ละโมดูล
src/
  utils/lineAuth.js (+ .test.js)   LINE_ERRORS, lineErrorMessage, readLineHash, hasPassword, isRecentSignIn
  firebase/lineAuth.js             startLine()
  components/LineButton.js         ปุ่ม LINE
  components/LineSection.js        ส่วน LINE ในหน้าตั้งค่า
  pages/LineCallback.js            /auth/line
  (แก้) App.js, pages/Login.js, pages/Register.js, pages/Settings.js, pages/Dashboard.js, index.css
public/service-worker.js       (แก้) ไม่แตะ /api/
firestore.rules, vercel.json, package.json, .gitignore, README.md, PRODUCT.md   (แก้)
```

---

# ช่วงที่ 1: LINE Login และการเชื่อมบัญชี

### Task 1: เตรียมฝั่ง server

**Files:**
- Modify: `package.json`, `vercel.json`, `.gitignore`
- Create: `api/_lib/http.mjs`, `api/_lib/config.mjs`, `api/_lib/firebaseAdmin.mjs`
- Test: `api/_lib/http.test.mjs`, `api/_lib/config.test.mjs`

**Interfaces:**
- Produces:
  - `json(data, status = 200, headers = {}) → Response`
  - `redirect(location, headers = {}) → Response` (302)
  - `safeReturnTo(value) → string | null`
  - `readLimits(env = process.env) → { perMinute, perDay }`
  - `config.{lineLoginChannelId, lineLoginChannelSecret, lineChannelSecret, lineAccessToken, cookieSecret, serviceAccount, limits}()`
  - `adminAuth() → Auth`, `adminDb() → Firestore`

- [ ] **Step 1: ติดตั้ง firebase-admin และเพิ่มสคริปต์เทสต์ฝั่ง server**

```bash
npm install firebase-admin@^14.5.0
```

แก้ `"scripts"` ใน `package.json` ให้เป็นแบบนี้:

```json
  "scripts": {
    "start": "react-scripts start",
    "build": "react-scripts build",
    "test": "react-scripts test",
    "test:server": "node --test \"api/**/*.test.mjs\"",
    "eject": "react-scripts eject"
  },
```

- [ ] **Step 2: ไม่ให้ rewrite ของ SPA ทับ `/api` และไม่ commit โฟลเดอร์ `.vercel`**

ใน `vercel.json` เปลี่ยน rewrite เป็น:

```json
  "rewrites": [
    {
      "source": "/((?!api/).*)",
      "destination": "/index.html"
    }
  ],
```

ต่อท้าย `.gitignore`:

```
# Vercel CLI (vercel dev / vercel link)
.vercel
```

- [ ] **Step 3: เขียนเทสต์ที่ยังไม่ผ่าน**

`api/_lib/http.test.mjs`
```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { json, redirect, safeReturnTo } from "./http.mjs";

test("safeReturnTo accepts internal paths only", () => {
    assert.equal(safeReturnTo("/settings"), "/settings");
    assert.equal(safeReturnTo("/dashboard?x=1"), "/dashboard?x=1");
    assert.equal(safeReturnTo("//evil.com"), null);
    assert.equal(safeReturnTo("/\\evil.com"), null);
    assert.equal(safeReturnTo("https://evil.com"), null);
    assert.equal(safeReturnTo(""), null);
    assert.equal(safeReturnTo(undefined), null);
});

test("json sets status, content type and extra headers", async () => {
    const res = json({ ok: true }, 201, { "X-A": "1" });
    assert.equal(res.status, 201);
    assert.equal(res.headers.get("content-type"), "application/json");
    assert.equal(res.headers.get("x-a"), "1");
    assert.deepEqual(await res.json(), { ok: true });
});

test("redirect is a 302 with Location and extra headers", () => {
    const res = redirect("/x", { "Set-Cookie": "a=b" });
    assert.equal(res.status, 302);
    assert.equal(res.headers.get("location"), "/x");
    assert.equal(res.headers.get("set-cookie"), "a=b");
});
```

`api/_lib/config.test.mjs`
```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { readLimits } from "./config.mjs";

test("readLimits defaults to 20 per minute and 300 per day", () => {
    assert.deepEqual(readLimits({}), { perMinute: 20, perDay: 300 });
});

test("readLimits reads non-negative integers and ignores junk", () => {
    assert.deepEqual(readLimits({ LINE_LIMIT_PER_MINUTE: "5", LINE_LIMIT_PER_DAY: "0" }), { perMinute: 5, perDay: 0 });
    assert.deepEqual(readLimits({ LINE_LIMIT_PER_MINUTE: "abc", LINE_LIMIT_PER_DAY: "-1" }), { perMinute: 20, perDay: 300 });
});
```

- [ ] **Step 4: รันเทสต์ให้เห็นว่ายังไม่ผ่าน**

Run: `npm run test:server`
Expected: FAIL เพราะ `Cannot find module '.../api/_lib/http.mjs'`

- [ ] **Step 5: เขียนโค้ด**

`api/_lib/http.mjs`
```js
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
```

`api/_lib/config.mjs`
```js
// ค่าลับและค่าตั้งต้นทั้งหมดมาจาก environment variables (Vercel และ .env.local)

const need = (name) => {
    const value = process.env[name];
    if (!value) throw new Error(`Missing environment variable ${name}`);
    return value;
};

const intOr = (value, fallback) => {
    const n = Number.parseInt(value ?? "", 10);
    return Number.isInteger(n) && n >= 0 ? n : fallback;
};

// เกณฑ์จำกัดการใช้บอท (ปรับรายคนได้ที่ lineUsage/{uid} ใน Firebase Console)
export const readLimits = (env = process.env) => ({
    perMinute: intOr(env.LINE_LIMIT_PER_MINUTE, 20),
    perDay: intOr(env.LINE_LIMIT_PER_DAY, 300),
});

export const config = {
    lineLoginChannelId: () => need("LINE_LOGIN_CHANNEL_ID"),
    lineLoginChannelSecret: () => need("LINE_LOGIN_CHANNEL_SECRET"),
    lineChannelSecret: () => need("LINE_CHANNEL_SECRET"),
    lineAccessToken: () => need("LINE_CHANNEL_ACCESS_TOKEN"),
    cookieSecret: () => need("AUTH_COOKIE_SECRET"),
    serviceAccount: () => JSON.parse(need("FIREBASE_SERVICE_ACCOUNT")),
    limits: () => readLimits(),
};
```

`api/_lib/firebaseAdmin.mjs`
```js
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { config } from "./config.mjs";

// admin SDK ข้าม Firestore Rules ได้ ใช้เฉพาะฝั่ง server
// สร้างครั้งเดียวต่อ instance (function ที่ยังอุ่นอยู่จะใช้ตัวเดิม)
const app = () => getApps()[0] ?? initializeApp({ credential: cert(config.serviceAccount()) });

export const adminAuth = () => getAuth(app());
export const adminDb = () => getFirestore(app());
```

- [ ] **Step 6: รันเทสต์ให้ผ่าน**

Run: `npm run test:server`
Expected: PASS ทั้ง 5 เทสต์

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json vercel.json .gitignore api/_lib/http.mjs api/_lib/http.test.mjs api/_lib/config.mjs api/_lib/config.test.mjs api/_lib/firebaseAdmin.mjs
git commit -m "Add Vercel Functions scaffolding for LINE features" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: cookie ที่ลงลายเซ็น และ LINE OAuth

**Files:**
- Create: `api/_lib/cookie.mjs`, `api/_lib/lineOAuth.mjs`, `api/_lib/testing/fakes.mjs`
- Test: `api/_lib/cookie.test.mjs`, `api/_lib/lineOAuth.test.mjs`

**Interfaces:**
- Produces:
  - `STATE_COOKIE = "line_oauth"`
  - `sealCookie(payload, secret, now = Date.now(), maxAgeSec = 600) → string`
  - `openCookie(value, secret, now = Date.now()) → object | null` (object มี field `exp` ติดมาด้วย)
  - `readCookie(header, name) → string | null`
  - `stateCookieHeader(value, maxAgeSec) → string`
  - `authorizeUrl({ channelId, redirectUri, state, nonce }) → string`
  - `exchangeCode({ code, redirectUri, channelId, channelSecret }, fetchImpl = fetch) → Promise<idToken>`
  - `verifyIdToken({ idToken, channelId, nonce }, fetchImpl = fetch) → Promise<{ lineUserId, name }>`
  - `randomToken() → string` (base64url 43 ตัวอักษร)
  - `fakeFetch(routes) → fetch` ที่มี `.calls = [{ url, init, body }]` โดย `routes[url] = { status = 200, body }`

- [ ] **Step 1: เขียนตัวช่วยเทสต์ `fakeFetch`**

`api/_lib/testing/fakes.mjs`
```js
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
```

- [ ] **Step 2: เขียนเทสต์ที่ยังไม่ผ่าน**

`api/_lib/cookie.test.mjs`
```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { openCookie, readCookie, sealCookie, stateCookieHeader } from "./cookie.mjs";

test("a sealed cookie opens before it expires", () => {
    const value = sealCookie({ state: "s", uid: null }, "key", 1000, 600);
    const data = openCookie(value, "key", 1000 + 599_000);
    assert.equal(data.state, "s");
    assert.equal(data.uid, null);
});

test("an expired cookie is rejected", () => {
    const value = sealCookie({ state: "s" }, "key", 1000, 600);
    assert.equal(openCookie(value, "key", 1000 + 600_001), null);
});

test("a tampered cookie or a different key is rejected", () => {
    const value = sealCookie({ state: "s" }, "key", 1000, 600);
    const [body, sig] = value.split(".");
    const forged = Buffer.from(JSON.stringify({ state: "evil", exp: 9e15 })).toString("base64url");
    assert.equal(openCookie(`${forged}.${sig}`, "key", 1000), null);
    assert.equal(openCookie(`${body}.${sig}x`, "key", 1000), null);
    assert.equal(openCookie(value, "other-key", 1000), null);
    assert.equal(openCookie("garbage", "key", 1000), null);
    assert.equal(openCookie(null, "key", 1000), null);
});

test("readCookie finds a cookie by name", () => {
    assert.equal(readCookie("a=1; line_oauth=x.y; b=2", "line_oauth"), "x.y");
    assert.equal(readCookie("a=1", "line_oauth"), null);
    assert.equal(readCookie(null, "line_oauth"), null);
});

test("the state cookie is HttpOnly, Secure, Lax and scoped to the LINE auth routes", () => {
    assert.equal(
        stateCookieHeader("v", 600),
        "line_oauth=v; Path=/api/auth/line; HttpOnly; Secure; SameSite=Lax; Max-Age=600"
    );
});
```

`api/_lib/lineOAuth.test.mjs`
```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { authorizeUrl, exchangeCode, randomToken, verifyIdToken } from "./lineOAuth.mjs";
import { fakeFetch } from "./testing/fakes.mjs";

const TOKEN = "https://api.line.me/oauth2/v2.1/token";
const VERIFY = "https://api.line.me/oauth2/v2.1/verify";

test("authorizeUrl asks for openid profile, sends state/nonce and the add-friend prompt", () => {
    const url = new URL(authorizeUrl({ channelId: "123", redirectUri: "https://app.test/cb", state: "s", nonce: "n" }));
    assert.equal(url.origin + url.pathname, "https://access.line.me/oauth2/v2.1/authorize");
    assert.equal(url.searchParams.get("response_type"), "code");
    assert.equal(url.searchParams.get("client_id"), "123");
    assert.equal(url.searchParams.get("redirect_uri"), "https://app.test/cb");
    assert.equal(url.searchParams.get("state"), "s");
    assert.equal(url.searchParams.get("nonce"), "n");
    assert.equal(url.searchParams.get("scope"), "openid profile");
    assert.equal(url.searchParams.get("bot_prompt"), "aggressive");
});

test("exchangeCode posts the form and returns the id_token", async () => {
    const f = fakeFetch({ [TOKEN]: { body: { id_token: "idt", access_token: "at" } } });
    const idToken = await exchangeCode({ code: "c", redirectUri: "https://app.test/cb", channelId: "123", channelSecret: "sec" }, f);
    assert.equal(idToken, "idt");
    assert.equal(f.calls[0].init.method, "POST");
    assert.equal(f.calls[0].init.headers["Content-Type"], "application/x-www-form-urlencoded");
    const form = new URLSearchParams(f.calls[0].body);
    assert.equal(form.get("grant_type"), "authorization_code");
    assert.equal(form.get("code"), "c");
    assert.equal(form.get("redirect_uri"), "https://app.test/cb");
    assert.equal(form.get("client_id"), "123");
    assert.equal(form.get("client_secret"), "sec");
});

test("exchangeCode throws when LINE refuses the code", async () => {
    const f = fakeFetch({ [TOKEN]: { status: 400, body: { error: "invalid_grant" } } });
    await assert.rejects(exchangeCode({ code: "c", redirectUri: "r", channelId: "1", channelSecret: "s" }, f));
});

test("verifyIdToken sends the expected nonce and returns the LINE user", async () => {
    const f = fakeFetch({ [VERIFY]: { body: { sub: "U1", name: "Ann", aud: "123" } } });
    assert.deepEqual(await verifyIdToken({ idToken: "idt", channelId: "123", nonce: "n" }, f), { lineUserId: "U1", name: "Ann" });
    const form = new URLSearchParams(f.calls[0].body);
    assert.equal(form.get("id_token"), "idt");
    assert.equal(form.get("client_id"), "123");
    assert.equal(form.get("nonce"), "n");
});

test("verifyIdToken throws when LINE rejects the token", async () => {
    const f = fakeFetch({ [VERIFY]: { status: 400, body: { error: "invalid_request", error_description: "Invalid IdToken Nonce." } } });
    await assert.rejects(verifyIdToken({ idToken: "idt", channelId: "123", nonce: "n" }, f));
});

test("randomToken is 43 url-safe characters and differs each call", () => {
    const a = randomToken();
    assert.match(a, /^[A-Za-z0-9_-]{43}$/);
    assert.notEqual(a, randomToken());
});
```

- [ ] **Step 3: รันเทสต์ให้เห็นว่ายังไม่ผ่าน**

Run: `node --test api/_lib/cookie.test.mjs api/_lib/lineOAuth.test.mjs`
Expected: FAIL เพราะ `Cannot find module` ทั้งสองไฟล์

- [ ] **Step 4: เขียนโค้ด**

`api/_lib/cookie.mjs`
```js
import { createHmac, timingSafeEqual } from "node:crypto";

// cookie ที่ลงลายเซ็น HMAC เก็บ state/nonce ระหว่างไปหน้า LINE แล้วกลับมา
// เนื้อหาอ่านได้ (base64url) แต่แก้ไม่ได้ และมีเวลาหมดอายุในตัว
export const STATE_COOKIE = "line_oauth";

const sign = (body, secret) => createHmac("sha256", secret).update(body).digest("base64url");

export function sealCookie(payload, secret, now = Date.now(), maxAgeSec = 600) {
    const body = Buffer.from(JSON.stringify({ ...payload, exp: now + maxAgeSec * 1000 })).toString("base64url");
    return `${body}.${sign(body, secret)}`;
}

export function openCookie(value, secret, now = Date.now()) {
    if (typeof value !== "string") return null;
    const [body, sig, extra] = value.split(".");
    if (!body || !sig || extra !== undefined) return null;
    const expected = Buffer.from(sign(body, secret));
    const given = Buffer.from(sig);
    if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
    try {
        const data = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
        return typeof data.exp === "number" && data.exp >= now ? data : null;
    } catch {
        return null;
    }
}

export function readCookie(header, name) {
    for (const part of (header || "").split(";")) {
        const [key, ...rest] = part.trim().split("=");
        if (key === name) return rest.join("=");
    }
    return null;
}

export const stateCookieHeader = (value, maxAgeSec) =>
    `${STATE_COOKIE}=${value}; Path=/api/auth/line; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAgeSec}`;
```

`api/_lib/lineOAuth.mjs`
```js
import { randomBytes } from "node:crypto";

// LINE Login v2.1: https://developers.line.biz/en/reference/line-login/
const AUTHORIZE_URL = "https://access.line.me/oauth2/v2.1/authorize";
const TOKEN_URL = "https://api.line.me/oauth2/v2.1/token";
const VERIFY_URL = "https://api.line.me/oauth2/v2.1/verify";
const FORM = { "Content-Type": "application/x-www-form-urlencoded" };

export const randomToken = () => randomBytes(32).toString("base64url");

// bot_prompt=aggressive: login เสร็จแล้ว LINE จะเปิดหน้าเพิ่มเพื่อนบอทให้
export function authorizeUrl({ channelId, redirectUri, state, nonce }) {
    const params = new URLSearchParams({
        response_type: "code",
        client_id: channelId,
        redirect_uri: redirectUri,
        state,
        scope: "openid profile",
        nonce,
        bot_prompt: "aggressive",
    });
    return `${AUTHORIZE_URL}?${params}`;
}

export async function exchangeCode({ code, redirectUri, channelId, channelSecret }, fetchImpl = fetch) {
    const res = await fetchImpl(TOKEN_URL, {
        method: "POST",
        headers: FORM,
        body: new URLSearchParams({
            grant_type: "authorization_code",
            code,
            redirect_uri: redirectUri,
            client_id: channelId,
            client_secret: channelSecret,
        }),
    });
    if (!res.ok) throw new Error(`LINE token exchange failed (${res.status})`);
    const data = await res.json();
    if (!data.id_token) throw new Error("LINE token response has no id_token");
    return data.id_token;
}

// ให้ LINE ตรวจลายเซ็น/อายุ/aud/nonce ของ ID token ให้ (endpoint verify)
export async function verifyIdToken({ idToken, channelId, nonce }, fetchImpl = fetch) {
    const res = await fetchImpl(VERIFY_URL, {
        method: "POST",
        headers: FORM,
        body: new URLSearchParams({ id_token: idToken, client_id: channelId, nonce }),
    });
    if (!res.ok) throw new Error(`LINE ID token verify failed (${res.status})`);
    const payload = await res.json();
    if (!payload.sub) throw new Error("LINE ID token has no sub");
    return { lineUserId: payload.sub, name: payload.name || "" };
}
```

- [ ] **Step 5: รันเทสต์ให้ผ่าน**

Run: `npm run test:server`
Expected: PASS ทุกเทสต์

- [ ] **Step 6: Commit**

```bash
git add api/_lib/cookie.mjs api/_lib/cookie.test.mjs api/_lib/lineOAuth.mjs api/_lib/lineOAuth.test.mjs api/_lib/testing/fakes.mjs
git commit -m "Add signed state cookie and LINE Login OAuth helpers" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: หาหรือสร้างบัญชี และผูก LINE

**Files:**
- Create: `api/_lib/accounts.mjs`
- Modify: `api/_lib/testing/fakes.mjs` (ต่อท้าย `fakeDb`, `fakeAuth`)
- Test: `api/_lib/accounts.test.mjs`

**Interfaces:**
- Consumes: ส่วนย่อยของ Firestore admin API คือ `db.collection(name).doc(id).get() / .create(data)` (ถ้ามีเอกสารอยู่แล้ว `create` จะโยน error ที่ `code === 6`) และ Auth admin API `createUser`, `deleteUser`
- Produces:
  - `resolveLoginUser({ lineUserId, name }, { auth, db, now? }) → Promise<uid>`
  - `linkLineAccount({ lineUserId, name, uid }, { db, now? }) → Promise<"linked" | "already_linked">`
  - `fakeDb() → { data: Map<"col/id", object>, hooks: { beforeCreate?(path) }, collection(name) }`
  - `fakeAuth() → { users, createUser, deleteUser, createCustomToken, verifyIdToken }` (`verifyIdToken("id-<uid>")` คืน `{ uid }` ค่าอื่นโยน error, `createCustomToken(uid)` คืน `"token-for-<uid>"`, uid ที่สร้างเรียงเป็น `uid1`, `uid2`, …)

- [ ] **Step 1: ต่อท้าย `api/_lib/testing/fakes.mjs`**

```js
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
```

- [ ] **Step 2: เขียนเทสต์ที่ยังไม่ผ่าน**

`api/_lib/accounts.test.mjs`
```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { linkLineAccount, resolveLoginUser } from "./accounts.mjs";
import { fakeAuth, fakeDb } from "./testing/fakes.mjs";

const NOW = new Date("2026-10-14T05:00:00Z");

test("a linked LINE user signs into the linked account without creating anyone", async () => {
    const db = fakeDb();
    const auth = fakeAuth();
    db.data.set("lineLinks/U1", { userId: "existing", displayName: "Ann" });
    assert.equal(await resolveLoginUser({ lineUserId: "U1", name: "Ann" }, { auth, db, now: NOW }), "existing");
    assert.equal(auth.users.size, 0);
});

test("a new LINE user gets a Firebase account named after LINE and a link", async () => {
    const db = fakeDb();
    const auth = fakeAuth();
    const uid = await resolveLoginUser({ lineUserId: "U1", name: "Ann" }, { auth, db, now: NOW });
    assert.equal(uid, "uid1");
    assert.equal(auth.users.get("uid1").displayName, "Ann");
    assert.deepEqual(db.data.get("lineLinks/U1"), { userId: "uid1", displayName: "Ann", linkedAt: NOW });
});

test("an empty or very long LINE name still gives a usable display name", async () => {
    const auth = fakeAuth();
    await resolveLoginUser({ lineUserId: "U1", name: "" }, { auth, db: fakeDb(), now: NOW });
    await resolveLoginUser({ lineUserId: "U2", name: "ก".repeat(80) }, { auth, db: fakeDb(), now: NOW });
    assert.equal(auth.users.get("uid1").displayName, "ผู้ใช้ LINE");
    assert.equal(auth.users.get("uid2").displayName.length, 50);
});

test("if another login linked the same LINE first, the extra account is removed", async () => {
    const db = fakeDb();
    const auth = fakeAuth();
    db.hooks.beforeCreate = (path) => {
        if (path === "lineLinks/U1") db.data.set(path, { userId: "winner", displayName: "Ann" });
    };
    assert.equal(await resolveLoginUser({ lineUserId: "U1", name: "Ann" }, { auth, db, now: NOW }), "winner");
    assert.equal(auth.users.size, 0);
});

test("linking attaches a free LINE account to the signed-in user", async () => {
    const db = fakeDb();
    assert.equal(await linkLineAccount({ lineUserId: "U1", name: "Ann", uid: "u42" }, { db, now: NOW }), "linked");
    assert.deepEqual(db.data.get("lineLinks/U1"), { userId: "u42", displayName: "Ann", linkedAt: NOW });
});

test("linking the same LINE again to the same user is fine, to another user is refused", async () => {
    const db = fakeDb();
    db.data.set("lineLinks/U1", { userId: "u42", displayName: "Ann" });
    assert.equal(await linkLineAccount({ lineUserId: "U1", name: "Ann", uid: "u42" }, { db, now: NOW }), "linked");
    assert.equal(await linkLineAccount({ lineUserId: "U1", name: "Ann", uid: "u99" }, { db, now: NOW }), "already_linked");
    assert.equal(db.data.get("lineLinks/U1").userId, "u42");
});
```

- [ ] **Step 3: รันเทสต์ให้เห็นว่ายังไม่ผ่าน**

Run: `node --test api/_lib/accounts.test.mjs`
Expected: FAIL เพราะ `Cannot find module '.../accounts.mjs'`

- [ ] **Step 4: เขียนโค้ด**

`api/_lib/accounts.mjs`
```js
// lineLinks/{lineUserId} = { userId, displayName, linkedAt }
// ใช้ lineUserId เป็น id เอกสาร -> LINE หนึ่งบัญชีผูกได้กับบัญชีแอปเดียว (create() ซ้ำจะล้ม)
const ALREADY_EXISTS = 6;
const displayNameOf = (name) => (name || "").trim().slice(0, 50) || "ผู้ใช้ LINE";

export async function resolveLoginUser({ lineUserId, name }, { auth, db, now = new Date() }) {
    const ref = db.collection("lineLinks").doc(lineUserId);
    const snap = await ref.get();
    if (snap.exists) return snap.data().userId;

    const user = await auth.createUser({ displayName: displayNameOf(name) });
    try {
        await ref.create({ userId: user.uid, displayName: name, linkedAt: now });
        return user.uid;
    } catch (err) {
        // ไม่ว่าจะล้มเพราะอะไร บัญชีที่เพิ่งสร้างไม่มีใครใช้ -> ลบทิ้ง
        await auth.deleteUser(user.uid).catch(() => {});
        if (err.code !== ALREADY_EXISTS) throw err;
        // อีก request หนึ่ง (เช่น กดสองแท็บพร้อมกัน) ผูกไปก่อน -> ใช้บัญชีนั้น
        return (await ref.get()).data().userId;
    }
}

export async function linkLineAccount({ lineUserId, name, uid }, { db, now = new Date() }) {
    const ref = db.collection("lineLinks").doc(lineUserId);
    try {
        await ref.create({ userId: uid, displayName: name, linkedAt: now });
        return "linked";
    } catch (err) {
        if (err.code !== ALREADY_EXISTS) throw err;
        return (await ref.get()).data().userId === uid ? "linked" : "already_linked";
    }
}
```

- [ ] **Step 5: รันเทสต์ให้ผ่าน**

Run: `npm run test:server`
Expected: PASS ทุกเทสต์

- [ ] **Step 6: Commit**

```bash
git add api/_lib/accounts.mjs api/_lib/accounts.test.mjs api/_lib/testing/fakes.mjs
git commit -m "Resolve and link Firebase accounts from LINE identities" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: endpoint `start` กับ `callback`

**Files:**
- Create: `api/_lib/authRoutes.mjs`, `api/auth/line/start.mjs`, `api/auth/line/callback.mjs`
- Test: `api/_lib/authRoutes.test.mjs`

**Interfaces:**
- Consumes: ของจาก Task 1–3 ทั้งหมด
- Produces:
  - `createStartHandler({ auth, cookieSecret, channelId, random = randomToken }) → (Request) => Promise<Response>`
    - body ที่รับ `{ mode: "login" | "link", returnTo? }` ในโหมด link ต้องมี header `Authorization: Bearer <Firebase ID token>`
    - ตอบ `{ url }` พร้อม `Set-Cookie`
  - `createCallbackHandler({ auth, db, cookieSecret, channelId, channelSecret, fetchImpl = fetch }) → (Request) => Promise<Response>` ตอบเป็น redirect เสมอ:
    - login สำเร็จ → `/auth/line#token=…&returnTo=…`
    - link สำเร็จ → `/settings?line=linked`
    - ผิดพลาดในโหมด login → `/?line_error=<cancelled|expired|failed>`
    - ผิดพลาดในโหมด link → `/settings?line_error=<cancelled|expired|failed|already_linked>`

  หมายเหตุ: spec บอกว่าทุกข้อผิดพลาดไปที่ `/?line_error=` แต่ในโหมด link ผู้ใช้ login อยู่ ถ้าไปที่ `/` `PublicRoute` จะเด้งไป dashboard ทันทีและข้อความหาย โหมด link จึงกลับไปที่ `/settings` แทน

- [ ] **Step 1: เขียนเทสต์ที่ยังไม่ผ่าน**

`api/_lib/authRoutes.test.mjs`
```js
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
```

- [ ] **Step 2: รันเทสต์ให้เห็นว่ายังไม่ผ่าน**

Run: `node --test api/_lib/authRoutes.test.mjs`
Expected: FAIL เพราะ `Cannot find module '.../authRoutes.mjs'`

- [ ] **Step 3: เขียนโค้ด**

`api/_lib/authRoutes.mjs`
```js
import { json, redirect, safeReturnTo } from "./http.mjs";
import { STATE_COOKIE, openCookie, readCookie, sealCookie, stateCookieHeader } from "./cookie.mjs";
import { authorizeUrl, exchangeCode, randomToken, verifyIdToken } from "./lineOAuth.mjs";
import { linkLineAccount, resolveLoginUser } from "./accounts.mjs";

const COOKIE_MAX_AGE = 600; // 10 นาที
const callbackUrl = (request) => `${new URL(request.url).origin}/api/auth/line/callback`;

// POST /api/auth/line/start  { mode: "login" | "link", returnTo? }
export function createStartHandler({ auth, cookieSecret, channelId, random = randomToken }) {
    return async (request) => {
        let body = {};
        try {
            body = (await request.json()) || {};
        } catch {
            body = {};
        }
        const mode = body.mode === "link" ? "link" : "login";
        const returnTo = safeReturnTo(body.returnTo) ?? (mode === "link" ? "/settings" : "/dashboard");

        // เชื่อมบัญชี: ต้องรู้ว่าใครกำลัง login อยู่ -> ตรวจ Firebase ID token
        let uid = null;
        if (mode === "link") {
            const header = request.headers.get("authorization") || "";
            try {
                uid = (await auth.verifyIdToken(header.replace(/^Bearer /, ""))).uid;
            } catch {
                return json({ error: "unauthorized" }, 401);
            }
        }

        const state = random();
        const nonce = random();
        const cookie = sealCookie({ state, nonce, mode, uid, returnTo }, cookieSecret, Date.now(), COOKIE_MAX_AGE);
        const url = authorizeUrl({ channelId, redirectUri: callbackUrl(request), state, nonce });
        return json({ url }, 200, {
            "Set-Cookie": stateCookieHeader(cookie, COOKIE_MAX_AGE),
            "Cache-Control": "no-store",
        });
    };
}

// GET /api/auth/line/callback?code&state  (หรือ ?error=... ถ้าผู้ใช้กดยกเลิก)
export function createCallbackHandler({ auth, db, cookieSecret, channelId, channelSecret, fetchImpl = fetch }) {
    return async (request) => {
        const url = new URL(request.url);
        const saved = openCookie(readCookie(request.headers.get("cookie"), STATE_COOKIE), cookieSecret);
        // ลบ cookie ทุกครั้ง (ใช้ได้ครั้งเดียว)
        const go = (path) => redirect(path, { "Set-Cookie": stateCookieHeader("", 0), "Cache-Control": "no-store" });
        const fail = (code) => go(saved?.mode === "link" ? `/settings?line_error=${code}` : `/?line_error=${code}`);

        if (!saved) return go("/?line_error=expired");
        const error = url.searchParams.get("error");
        if (error) return fail(error.toLowerCase() === "access_denied" ? "cancelled" : "failed");
        if (url.searchParams.get("state") !== saved.state) return fail("expired");
        const code = url.searchParams.get("code");
        if (!code) return fail("failed");

        try {
            const idToken = await exchangeCode({ code, redirectUri: callbackUrl(request), channelId, channelSecret }, fetchImpl);
            const profile = await verifyIdToken({ idToken, channelId, nonce: saved.nonce }, fetchImpl);

            if (saved.mode === "link") {
                const result = await linkLineAccount({ ...profile, uid: saved.uid }, { db });
                return result === "linked" ? go("/settings?line=linked") : fail(result);
            }

            const uid = await resolveLoginUser(profile, { auth, db });
            const token = await auth.createCustomToken(uid);
            // token อยู่หลัง # -> เบราว์เซอร์ไม่ส่งไป server จึงไม่ติดใน log
            const hash = new URLSearchParams({ token, returnTo: saved.returnTo || "/dashboard" });
            return go(`/auth/line#${hash}`);
        } catch (err) {
            console.error("LINE callback failed:", err?.message);
            return fail("failed");
        }
    };
}
```

`api/auth/line/start.mjs`
```js
import { createStartHandler } from "../../_lib/authRoutes.mjs";
import { config } from "../../_lib/config.mjs";
import { adminAuth } from "../../_lib/firebaseAdmin.mjs";

export async function POST(request) {
    const handle = createStartHandler({
        auth: adminAuth(),
        cookieSecret: config.cookieSecret(),
        channelId: config.lineLoginChannelId(),
    });
    return handle(request);
}
```

`api/auth/line/callback.mjs`
```js
import { createCallbackHandler } from "../../_lib/authRoutes.mjs";
import { config } from "../../_lib/config.mjs";
import { adminAuth, adminDb } from "../../_lib/firebaseAdmin.mjs";

export async function GET(request) {
    const handle = createCallbackHandler({
        auth: adminAuth(),
        db: adminDb(),
        cookieSecret: config.cookieSecret(),
        channelId: config.lineLoginChannelId(),
        channelSecret: config.lineLoginChannelSecret(),
    });
    return handle(request);
}
```

- [ ] **Step 4: รันเทสต์ให้ผ่าน**

Run: `npm run test:server`
Expected: PASS ทุกเทสต์

- [ ] **Step 5: เช็กว่าไฟล์ endpoint import ได้โดยไม่มี syntax error** (ไม่ต้องมี env เพราะแค่ import ยังไม่เรียกฟังก์ชัน)

Run: `node -e "Promise.all([import('./api/auth/line/start.mjs'), import('./api/auth/line/callback.mjs')]).then(() => console.log('ok'))"`
Expected: `ok`

- [ ] **Step 6: Commit**

```bash
git add api/_lib/authRoutes.mjs api/_lib/authRoutes.test.mjs api/auth/line/start.mjs api/auth/line/callback.mjs
git commit -m "Add LINE Login start and callback endpoints" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: ตัวช่วยฝั่งเว็บ

**Files:**
- Create: `src/utils/lineAuth.js`, `src/firebase/lineAuth.js`
- Test: `src/utils/lineAuth.test.js`

**Interfaces:**
- Produces:
  - `LINE_ERRORS`
  - `lineErrorMessage(code) → string` (ถ้าไม่มี code คืน `""` ถ้าเป็น code ที่ไม่รู้จักคืนข้อความของ `failed`)
  - `readLineHash(hash) → { token: string | null, returnTo: string }`
  - `hasPassword(user) → boolean`
  - `isRecentSignIn(user, now = Date.now()) → boolean` (นับว่า "เพิ่ง login" ถ้าไม่เกิน 4 นาที)
  - `startLine({ mode = "login", returnTo } = {}) → Promise<void>` (สั่งเปลี่ยนหน้าไป LINE ถ้า server ตอบผิดพลาดจะโยน error)

- [ ] **Step 1: เขียนเทสต์ที่ยังไม่ผ่าน**

`src/utils/lineAuth.test.js`
```js
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
```

- [ ] **Step 2: รันเทสต์ให้เห็นว่ายังไม่ผ่าน**

Run: `CI=true npm test -- --watchAll=false src/utils/lineAuth.test.js`
Expected: FAIL เพราะ `Cannot find module './lineAuth'`

- [ ] **Step 3: เขียนโค้ด**

`src/utils/lineAuth.js`
```js
// ตัวช่วยฝั่งหน้าเว็บสำหรับ LINE Login (ไม่ import Firebase เพื่อให้เทสต์ได้)

export const LINE_ERRORS = {
    cancelled: "ยกเลิกการเข้าสู่ระบบด้วย LINE",
    expired: "ลิงก์หมดอายุ ลองใหม่อีกครั้ง",
    already_linked: "LINE นี้เชื่อมกับบัญชีอื่นอยู่แล้ว",
    failed: "เข้าสู่ระบบด้วย LINE ไม่สำเร็จ ลองใหม่อีกครั้ง",
};

export const lineErrorMessage = (code) => (code ? LINE_ERRORS[code] || LINE_ERRORS.failed : "");

const safePath = (path) =>
    path && path.startsWith("/") && !path.startsWith("//") && !path.startsWith("/\\") ? path : "/dashboard";

// /auth/line#token=...&returnTo=/settings
export function readLineHash(hash) {
    const params = new URLSearchParams((hash || "").replace(/^#/, ""));
    return { token: params.get("token"), returnTo: safePath(params.get("returnTo")) };
}

// บัญชีที่สมัครด้วยอีเมล (ถึงจะเชื่อม LINE แล้วก็ยังมี provider "password")
export const hasPassword = (user) => Boolean(user?.providerData?.some((p) => p.providerId === "password"));

// Firebase ยอมให้ลบบัญชีถ้า login มาไม่เกิน 5 นาที -> เผื่อไว้ใช้ 4 นาที
const RECENT_MS = 4 * 60 * 1000;
export function isRecentSignIn(user, now = Date.now()) {
    const at = Date.parse(user?.metadata?.lastSignInTime || "");
    return Number.isFinite(at) && now - at < RECENT_MS;
}
```

`src/firebase/lineAuth.js`
```js
import { auth } from "./config";

// เริ่ม LINE Login: ขอ URL จาก server (server ฝัง state ไว้ใน cookie) แล้วพาไปหน้า LINE
// mode "link" = เชื่อม LINE กับบัญชีที่ login อยู่ -> ส่ง ID token ให้ server รู้ว่าเป็นใคร
export async function startLine({ mode = "login", returnTo } = {}) {
    const headers = { "Content-Type": "application/json" };
    if (mode === "link") headers.Authorization = `Bearer ${await auth.currentUser.getIdToken()}`;
    const res = await fetch("/api/auth/line/start", {
        method: "POST",
        headers,
        body: JSON.stringify({ mode, returnTo }),
    });
    if (!res.ok) throw new Error(`line-start-${res.status}`);
    const { url } = await res.json();
    window.location.assign(url);
}
```

- [ ] **Step 4: รันเทสต์ให้ผ่าน**

Run: `CI=true npm test -- --watchAll=false src/utils/lineAuth.test.js`
Expected: PASS 4 เทสต์

- [ ] **Step 5: Commit**

```bash
git add src/utils/lineAuth.js src/utils/lineAuth.test.js src/firebase/lineAuth.js
git commit -m "Add web helpers for LINE Login" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: ปุ่ม LINE ในหน้า login และ register และหน้า `/auth/line`

**Files:**
- Create: `src/components/LineButton.js`, `src/pages/LineCallback.js`
- Modify: `src/App.js`, `src/pages/Login.js`, `src/pages/Register.js`, `src/index.css`, `public/service-worker.js`

**Interfaces:**
- Consumes: `startLine`, `lineErrorMessage`, `readLineHash` (Task 5) และ `useAuth()` (เดิม)
- Produces: `<LineButton mode? returnTo? onError?>{label}</LineButton>` ค่าเริ่มต้นของ label คือ "เข้าสู่ระบบด้วย LINE"

- [ ] **Step 1: สร้าง `src/components/LineButton.js`**

```js
import { useEffect, useState } from "react";
import { MessageCircle } from "lucide-react";
import { startLine } from "../firebase/lineAuth";
import { lineErrorMessage } from "../utils/lineAuth";

// ปุ่มไปหน้า LINE Login (ใช้ทั้งเข้าสู่ระบบ สมัคร เชื่อมบัญชี และยืนยันตัวตนใหม่ก่อนลบบัญชี)
export default function LineButton({ mode = "login", returnTo, onError, children = "เข้าสู่ระบบด้วย LINE" }) {
    const [busy, setBusy] = useState(false);

    // กด back กลับมาจากหน้า LINE -> เบราว์เซอร์คืนหน้าจากแคช (ปุ่มยังค้างสถานะ busy)
    useEffect(() => {
        const onShow = (e) => e.persisted && setBusy(false);
        window.addEventListener("pageshow", onShow);
        return () => window.removeEventListener("pageshow", onShow);
    }, []);

    const go = async () => {
        setBusy(true);
        try {
            await startLine({ mode, returnTo });
        } catch {
            setBusy(false);
            onError?.(lineErrorMessage("failed"));
        }
    };

    return (
        <button type="button" className="btn btn-line w-100" onClick={go} disabled={busy}>
            <MessageCircle size={18} aria-hidden="true" />
            {busy ? "กำลังไปที่ LINE..." : children}
        </button>
    );
}
```

- [ ] **Step 2: เพิ่มสไตล์ใน `src/index.css`** ต่อจากบล็อก `.auth-switch { ... }` (ประมาณบรรทัด 1799–1805)

```css
/* ปุ่ม LINE: เขียวของ LINE (#06C755) ตัวหนังสือสีเข้มคงที่ทั้งโหมดสว่าง/มืด
   (ขาวบนเขียวนี้ contrast แค่ ~2.3:1 ไม่ผ่าน WCAG ส่วนสีเข้มนี้ได้ ~7.5:1) */
.btn-line {
  --bs-btn-color: #08240f;
  --bs-btn-bg: #06c755;
  --bs-btn-border-color: #06c755;
  --bs-btn-hover-color: #08240f;
  --bs-btn-hover-bg: #05b84e;
  --bs-btn-hover-border-color: #05b84e;
  --bs-btn-active-color: #08240f;
  --bs-btn-active-bg: #04a847;
  --bs-btn-active-border-color: #04a847;
  --bs-btn-disabled-color: #08240f;
  --bs-btn-disabled-bg: #06c755;
  --bs-btn-disabled-border-color: #06c755;
  --bs-btn-disabled-opacity: 0.6;
}

.auth-divider {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  color: var(--ink-2);
  font-size: 0.875rem;
}

.auth-divider::before,
.auth-divider::after {
  content: "";
  flex: 1;
  border-top: 1px solid var(--rule);
}
```

- [ ] **Step 3: สร้าง `src/pages/LineCallback.js`**

```js
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { signInWithCustomToken } from "firebase/auth";
import { auth } from "../firebase/config";
import { useAuth } from "../context/AuthContext";
import { readLineHash } from "../utils/lineAuth";
import { RosetteMark } from "../components/Guilloche";

// /auth/line#token=...&returnTo=...  (server ส่งมาหลัง LINE Login สำเร็จ)
export default function LineCallback() {
    const navigate = useNavigate();
    const { user } = useAuth();
    const started = useRef(false); // StrictMode เรียก effect สองรอบ -> sign in ครั้งเดียว
    const [target, setTarget] = useState(null);

    useEffect(() => {
        if (started.current) return;
        started.current = true;
        const { token, returnTo } = readLineHash(window.location.hash);
        // ล้าง token ออกจากแถบ URL/ประวัติทันที
        window.history.replaceState(null, "", window.location.pathname);
        if (!token) {
            navigate("/?line_error=failed", { replace: true });
            return;
        }
        signInWithCustomToken(auth, token)
            .then(() => setTarget(returnTo))
            .catch(() => navigate("/?line_error=failed", { replace: true }));
    }, [navigate]);

    // รอให้ AuthContext เห็นผู้ใช้ก่อน ไม่งั้น PrivateRoute จะเด้งกลับหน้า login
    useEffect(() => {
        if (target && user) navigate(target, { replace: true });
    }, [target, user, navigate]);

    return (
        <div className="app-loading" role="status" aria-label="กำลังเข้าสู่ระบบด้วย LINE">
            <RosetteMark size={36} />
            <span className="bar" />
        </div>
    );
}
```

- [ ] **Step 4: เพิ่ม route ใน `src/App.js`**

เพิ่ม import ต่อจาก `import Settings from "./pages/Settings";`:
```js
import LineCallback from "./pages/LineCallback";
```

เพิ่ม route ก่อนบรรทัด `<Route path="*" ... />` (ไม่ครอบด้วย `PublicRoute` หรือ `PrivateRoute`):
```js
            <Route path="/auth/line" element={<LineCallback />} />
```

- [ ] **Step 5: แก้ `src/pages/Login.js`**

เปลี่ยน `import { Link } from "react-router-dom";` เป็น:
```js
import { Link, useSearchParams } from "react-router-dom";
```
และเพิ่ม import ต่อจาก `import Sheet from "../components/Sheet";`:
```js
import LineButton from "../components/LineButton";
import { lineErrorMessage } from "../utils/lineAuth";
```

เพิ่มใต้ `const id = useId();`:
```js
  const [searchParams] = useSearchParams();
  // กลับจากหน้า LINE แบบไม่สำเร็จ -> callback แนบ ?line_error=... มา
  const lineError = lineErrorMessage(searchParams.get("line_error"));
```

แทนที่บล็อกนี้:
```js
        {!error && expired && (
          <div className="form-error is-warn" role="status">
            <Clock size={16} aria-hidden="true" />
            <span>เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่อีกครั้ง</span>
          </div>
        )}
```
ด้วย:
```js
        {!error && expired && (
          <div className="form-error is-warn" role="status">
            <Clock size={16} aria-hidden="true" />
            <span>เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่อีกครั้ง</span>
          </div>
        )}
        {!error && !expired && lineError && (
          <div className="form-error" role="alert">
            <OctagonAlert size={16} aria-hidden="true" />
            <span>{lineError}</span>
          </div>
        )}

        <LineButton onError={setError} />
        <div className="auth-divider">หรือใช้อีเมล</div>
```

- [ ] **Step 6: แก้ `src/pages/Register.js`**

เพิ่ม import ต่อจาก `import AuthShell from "../components/AuthShell";`:
```js
import LineButton from "../components/LineButton";
```

แทนที่:
```js
                <div>
                    <label className="form-label" htmlFor={`${id}-name`}>
```
ด้วย:
```js
                <LineButton onError={setError}>สมัครด้วย LINE</LineButton>
                <div className="auth-divider">หรือสมัครด้วยอีเมล</div>

                <div>
                    <label className="form-label" htmlFor={`${id}-name`}>
```

- [ ] **Step 7: ไม่ให้ service worker แตะ `/api/`** ใน `public/service-worker.js` ต่อจากบรรทัด `if (url.origin !== self.location.origin) return;`:

```js
  // API (LINE Login callback ฯลฯ) ต้องไปถึง server เสมอ ห้ามตอบจากแคช
  if (url.pathname.startsWith("/api/")) return;
```

- [ ] **Step 8: รันเทสต์เว็บทั้งหมดและ build**

Run: `CI=true npm test -- --watchAll=false`
Expected: PASS ทุกไฟล์เทสต์

Run: `CI=true npm run build`
Expected: `Compiled successfully.` ไม่มี warning

- [ ] **Step 9: ดูหน้าตาด้วยตา** รัน `npm start` แล้วเปิด `http://localhost:3000/` กับ `/register` ทั้งจอแคบ (375px) และจอกว้าง ในโหมดสว่างและมืด ต้องเห็นปุ่มเขียว "เข้าสู่ระบบด้วย LINE" หรือ "สมัครด้วย LINE" อยู่บนสุด และเส้นคั่น "หรือใช้อีเมล" เปิด `/?line_error=cancelled` ต้องเห็นข้อความ "ยกเลิกการเข้าสู่ระบบด้วย LINE" (ตอนรัน `npm start` กดปุ่ม LINE แล้วจะขึ้น error เพราะไม่มี `/api` ข้อนี้ปกติ การทดสอบจริงอยู่ใน Task 15)

- [ ] **Step 10: Commit**

```bash
git add src/components/LineButton.js src/pages/LineCallback.js src/App.js src/pages/Login.js src/pages/Register.js src/index.css public/service-worker.js
git commit -m "Add LINE sign-in button and /auth/line finish page" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: หน้าตั้งค่า, Dashboard และ Firestore rules

**Files:**
- Create: `src/components/LineSection.js`
- Modify: `src/pages/Settings.js`, `src/pages/Dashboard.js`, `firestore.rules`

**Interfaces:**
- Consumes: `LineButton` (Task 6) และ `hasPassword`, `isRecentSignIn`, `lineErrorMessage` (Task 5)
- Produces: `<LineSection user canUnlink notify />` ใช้แสดงเนื้อหาภายใน `<Section title="LINE">`

- [ ] **Step 1: สร้าง `src/components/LineSection.js`**

```js
import { useEffect, useState } from "react";
import { collection, deleteDoc, doc, getDocs, limit, query, where } from "firebase/firestore";
import { CircleCheck } from "lucide-react";
import { db } from "../firebase/config";
import { errorMessage } from "../firebase/errors";
import LineButton from "./LineButton";

const ADD_FRIEND_URL = process.env.REACT_APP_LINE_ADD_FRIEND_URL;

// ส่วน "LINE" ในหน้าตั้งค่า: เชื่อม/ยกเลิกการเชื่อม และลิงก์เพิ่มเพื่อนบอท
export default function LineSection({ user, canUnlink, notify }) {
    const [link, setLink] = useState(undefined); // undefined = กำลังโหลด, null = ยังไม่เชื่อม
    const [busy, setBusy] = useState(false);

    useEffect(() => {
        let alive = true;
        getDocs(query(collection(db, "lineLinks"), where("userId", "==", user.uid), limit(1)))
            .then((snap) => alive && setLink(snap.empty ? null : { id: snap.docs[0].id, ...snap.docs[0].data() }))
            .catch(() => alive && setLink(null));
        return () => {
            alive = false;
        };
    }, [user.uid]);

    const unlink = async () => {
        try {
            setBusy(true);
            await deleteDoc(doc(db, "lineLinks", link.id));
            setLink(null);
            notify("ยกเลิกการเชื่อม LINE แล้ว");
        } catch (err) {
            notify(errorMessage(err), "danger");
        } finally {
            setBusy(false);
        }
    };

    if (link === undefined) return <p className="muted mb-0">กำลังโหลด...</p>;

    if (!link) {
        return (
            <>
                <p className="muted mb-3">
                    เชื่อมบัญชี LINE เพื่อจดรายรับ-รายจ่ายผ่านแชท LINE ได้ทันที เช่น พิมพ์ “ค่าข้าว 50”
                </p>
                <LineButton mode="link" onError={(m) => notify(m, "danger")}>
                    เชื่อมบัญชี LINE
                </LineButton>
            </>
        );
    }

    return (
        <>
            <div className="d-flex flex-wrap align-items-center gap-2 mb-3">
                <span>
                    เชื่อมกับ LINE: <strong>{link.displayName || "บัญชี LINE"}</strong>
                </span>
                <span className="badge-state is-ok">
                    <CircleCheck size={15} aria-hidden="true" />
                    เชื่อมแล้ว
                </span>
            </div>
            {!canUnlink && <p className="muted mb-3">บัญชีนี้เข้าสู่ระบบด้วย LINE</p>}
            <div className="d-flex flex-wrap gap-2">
                {ADD_FRIEND_URL && (
                    <a className="btn btn-ghost" href={ADD_FRIEND_URL} target="_blank" rel="noopener noreferrer">
                        เพิ่มเพื่อนบอท
                    </a>
                )}
                {canUnlink && (
                    <button type="button" className="btn btn-quiet" onClick={unlink} disabled={busy}>
                        {busy ? "กำลังยกเลิก..." : "ยกเลิกการเชื่อม"}
                    </button>
                )}
            </div>
        </>
    );
}
```

- [ ] **Step 2: แก้ import ใน `src/pages/Settings.js`**

- `import { useId, useState } from "react";` → `import { useEffect, useId, useState } from "react";`
- `import { Link } from "react-router-dom";` → `import { Link, useSearchParams } from "react-router-dom";`
- `import { ArrowLeft, CircleCheck, Download, LogOut, TriangleAlert } from "lucide-react";` → `import { ArrowLeft, CircleCheck, Clock, Download, LogOut, TriangleAlert } from "lucide-react";`
- เพิ่มต่อจาก `import { toInputDate } from "../utils/format";`:
```js
import { hasPassword, isRecentSignIn, lineErrorMessage } from "../utils/lineAuth";
import LineButton from "../components/LineButton";
import LineSection from "../components/LineSection";
```

- [ ] **Step 3: เพิ่ม state และการแจ้งผลหลังกลับจาก LINE** ใต้ `const id = useId();` ใน `Settings()`:

```js
    const passwordUser = hasPassword(user);
    const [searchParams, setSearchParams] = useSearchParams();

    // กลับมาจากหน้า LINE (เชื่อมบัญชี) -> แจ้งผลครั้งเดียวแล้วล้าง query
    useEffect(() => {
        const linked = searchParams.get("line") === "linked";
        const lineError = lineErrorMessage(searchParams.get("line_error"));
        if (!linked && !lineError) return;
        notify(linked ? "เชื่อมบัญชี LINE แล้ว" : lineError, linked ? "success" : "danger");
        setSearchParams({}, { replace: true });
    }, [searchParams, setSearchParams, notify]);
```

- [ ] **Step 4: แทนที่ส่วนลบบัญชีทั้งบล็อก** ตั้งแต่ `// ลบบัญชี` ไปจนถึง `};` ที่ปิด `deleteAccount` ด้วย:

```js
    // ลบบัญชี
    const [del, setDel] = useState({ password: "", confirm: "" });
    const [delBusy, setDelBusy] = useState(false);
    const [needsRelogin, setNeedsRelogin] = useState(false);
    const deleteAccount = async (e) => {
        e.preventDefault();
        if (!navigator.onLine) return notify("ต้องเชื่อมต่ออินเทอร์เน็ตก่อนลบบัญชี", "danger");
        if (del.confirm !== "ลบบัญชี") return notify('กรุณาพิมพ์คำว่า "ลบบัญชี" ให้ถูกต้อง', "danger");
        // บัญชี LINE อย่างเดียวยืนยันด้วยรหัสผ่านไม่ได้ -> ต้อง login มาไม่นาน
        // เช็กก่อนลบอะไร ไม่งั้นข้อมูลหายแต่ลบบัญชีไม่ผ่าน
        if (!passwordUser && !isRecentSignIn(user)) return setNeedsRelogin(true);
        try {
            setDelBusy(true);
            if (passwordUser) await reauth(user, del.password);
            await deleteAllOwned("transactions", user.uid);
            await deleteAllOwned("recurring", user.uid);
            await deleteAllOwned("lineDrafts", user.uid);
            await deleteAllOwned("lineLinks", user.uid);
            const batch = writeBatch(db);
            batch.delete(doc(db, "budgets", user.uid));
            batch.delete(doc(db, "lineDicts", user.uid));
            await batch.commit();
            await deleteUser(user);
            notify("ลบบัญชีและข้อมูลทั้งหมดแล้ว");
        } catch (err) {
            if (err?.code === "auth/requires-recent-login" && !passwordUser) setNeedsRelogin(true);
            notify(errorMessage(err), "danger");
            setDelBusy(false);
        }
    };
```

- [ ] **Step 5: แก้ส่วนหัวกับส่วนโปรไฟล์ให้รองรับบัญชีที่ไม่มีอีเมล**

แทนที่ `<p>{user.displayName ? `${user.displayName} · ${user.email}` : user.email}</p>` ด้วย:
```js
                <p>{[user.displayName, user.email].filter(Boolean).join(" · ")}</p>
```

ใน `<Section title="โปรไฟล์">` แทนที่ส่วนอีเมลทั้งก้อน (ตั้งแต่ `<div className="mt-4">` จนถึง `</div>` ตัวที่ปิดก่อน `</Section>`) ด้วยเวอร์ชันที่แสดงเฉพาะบัญชีที่มีอีเมล:
```js
                {user.email && (
                    <div className="mt-4">
                        <span className="form-label d-block">อีเมล</span>
                        <div className="d-flex flex-wrap align-items-center gap-2">
                            <span className="text-break">{user.email}</span>
                            {user.emailVerified ? (
                                <span className="badge-state is-ok">
                                    <CircleCheck size={15} aria-hidden="true" />
                                    ยืนยันแล้ว
                                </span>
                            ) : (
                                <span className="badge-state is-warn">
                                    <TriangleAlert size={15} aria-hidden="true" />
                                    ยังไม่ยืนยัน
                                </span>
                            )}
                        </div>
                        {!user.emailVerified && (
                            <div className="d-flex flex-wrap gap-2 mt-2">
                                <button className="btn btn-ghost btn-sm" onClick={sendVerify} disabled={sending}>
                                    {sending ? "กำลังส่ง..." : "ส่งอีเมลยืนยัน"}
                                </button>
                                <button className="btn btn-quiet btn-sm" onClick={checkVerified}>
                                    ฉันยืนยันแล้ว
                                </button>
                            </div>
                        )}
                    </div>
                )}
```

- [ ] **Step 6: เพิ่มส่วน LINE และซ่อนส่วนเปลี่ยนรหัสผ่านจากบัญชี LINE อย่างเดียว**

แทนที่ `            <Section title="เปลี่ยนรหัสผ่าน">` ด้วย:
```js
            <Section title="LINE">
                <LineSection user={user} canUnlink={passwordUser} notify={notify} />
            </Section>

            {passwordUser && (
                <Section title="เปลี่ยนรหัสผ่าน">
```
จากนั้นเยื้องเนื้อหาข้างใน Section นี้เพิ่ม 4 ช่อง และแทนที่ `</Section>` ที่ปิดส่วนเปลี่ยนรหัสผ่าน (ตัวที่อยู่ก่อน `<Section title="ข้อมูลของฉัน">`) ด้วย:
```js
                </Section>
            )}
```

- [ ] **Step 7: แก้ฟอร์มลบบัญชี**

ในข้อความอธิบาย เปลี่ยน `(รายการ งบประมาณ รายการประจำ)` เป็น `(รายการ งบประมาณ รายการประจำ การเชื่อม LINE)`

ครอบช่อง "รหัสผ่านปัจจุบัน" ของฟอร์มลบ (`<div>` ที่มี `htmlFor={`${id}-del-pw`}`) ด้วย `{passwordUser && ( ... )}` และเพิ่มก่อน `<button type="submit" className="btn btn-danger w-100"`:
```js
                    {needsRelogin && (
                        <>
                            <div className="form-error is-warn" role="status">
                                <Clock size={16} aria-hidden="true" />
                                <span>เพื่อความปลอดภัย กรุณาเข้าสู่ระบบด้วย LINE อีกครั้งก่อนลบบัญชี</span>
                            </div>
                            <LineButton returnTo="/settings" onError={(m) => notify(m, "danger")}>
                                เข้าสู่ระบบด้วย LINE อีกครั้ง
                            </LineButton>
                        </>
                    )}
```

- [ ] **Step 8: Dashboard ไม่ต้องเตือนเรื่องยืนยันอีเมลกับบัญชี LINE อย่างเดียว**

ใน `src/pages/Dashboard.js` เพิ่ม import ต่อจาก import ตัวสุดท้ายที่มาจาก `../utils/`:
```js
import { hasPassword } from "../utils/lineAuth";
```
แล้วเปลี่ยน `{!user.emailVerified && (` เป็น:
```js
                {hasPassword(user) && !user.emailVerified && (
```

- [ ] **Step 9: เพิ่ม Firestore rules** ใน `firestore.rules` ต่อจากบล็อก `match /budgets/{uid} { ... }` (ก่อน `}` สองตัวสุดท้าย):

```
    // LINE: server (admin SDK) เป็นคนเขียน หน้าเว็บอ่าน/ลบได้เฉพาะของตัวเอง
    match /lineLinks/{lineUserId} {
      allow read, delete: if signedIn() && resource.data.userId == request.auth.uid;
    }

    match /lineDicts/{uid} {
      allow read, delete: if signedIn() && request.auth.uid == uid;
    }

    match /lineDrafts/{id} {
      allow read, delete: if signedIn() && resource.data.userId == request.auth.uid;
    }

    // lineUsage: ไม่มี rule = หน้าเว็บอ่าน/เขียนไม่ได้ (กันลบตัวนับเพื่อหลบเกณฑ์จำกัด)
```

- [ ] **Step 10: รันเทสต์และ build**

Run: `CI=true npm test -- --watchAll=false`
Expected: PASS

Run: `CI=true npm run build`
Expected: `Compiled successfully.` ไม่มี warning (เช่น import ที่ไม่ได้ใช้)

- [ ] **Step 11: ดูหน้าตั้งค่าด้วยตา** รัน `npm start` แล้ว login ด้วยบัญชีอีเมล ไปที่ `/settings` ต้องเห็นส่วน "LINE" พร้อมปุ่ม "เชื่อมบัญชี LINE" ส่วนเปลี่ยนรหัสผ่านยังอยู่ และช่องรหัสผ่านในฟอร์มลบบัญชียังอยู่ เปิด `/settings?line=linked` ต้องเห็น toast "เชื่อมบัญชี LINE แล้ว" และ query หายไปจาก URL

- [ ] **Step 12: Commit**

```bash
git add src/components/LineSection.js src/pages/Settings.js src/pages/Dashboard.js firestore.rules
git commit -m "Add LINE section to settings and support LINE-only accounts" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

# ช่วงที่ 2: ตัวแยกข้อความ

### Task 8: หมวดหมู่ฝั่ง server และวันที่ไทย

**Files:**
- Create: `api/_lib/categories.mjs`, `api/_lib/thaiDate.mjs`
- Test: `api/_lib/categories.test.mjs`, `api/_lib/thaiDate.test.mjs`

**Interfaces:**
- Produces:
  - `CATEGORIES`, `EXPENSE`, `INCOME` ซึ่งเป็น `[{ key, label, short, type }]`
  - `categoryOf(key) → category | null`, `isCategory(key) → boolean`, `typeOf(key) → "income" | "expense"`
  - `bangkokYmd(now) → "YYYY-MM-DD"`, `addDays(date, n)`, `ymd(y, m, d)`, `isValidYmd(y, m, d)`, `noonBangkok(date) → Date`
  - `monthBounds(date) → { start: Date, end: Date }`, `monthKey(date) → "YYYY-MM"`, `minuteIndex(now) → number`
  - `thaiShortDate(date, withYear = false)`, `dateLabel(date, today)`, `monthLabel(date)`

- [ ] **Step 1: เขียนเทสต์ที่ยังไม่ผ่าน**

`api/_lib/categories.test.mjs`
```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { CATEGORIES, EXPENSE, INCOME, categoryOf, isCategory, typeOf } from "./categories.mjs";
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES } from "../../src/constants/categories.js";

const pairs = (list) => list.map(({ key, label }) => [key, label]);

test("server categories match the web app's categories exactly", () => {
    assert.deepEqual(pairs(EXPENSE), pairs(EXPENSE_CATEGORIES));
    assert.deepEqual(pairs(INCOME), pairs(INCOME_CATEGORIES));
});

test("every LINE button label fits LINE's 20 character limit", () => {
    for (const c of CATEGORIES) assert.ok(c.short.length <= 20, `${c.key}: ${c.short}`);
});

test("lookups", () => {
    assert.equal(categoryOf("bills").short, "น้ำ/ไฟ/เน็ต/โทร");
    assert.equal(categoryOf("nope"), null);
    assert.equal(isCategory("salary"), true);
    assert.equal(isCategory("hacker"), false);
    assert.equal(typeOf("salary"), "income");
    assert.equal(typeOf("food"), "expense");
});
```

`api/_lib/thaiDate.test.mjs`
```js
import { test } from "node:test";
import assert from "node:assert/strict";
import {
    addDays, bangkokYmd, dateLabel, isValidYmd, minuteIndex, monthBounds, monthKey, monthLabel, noonBangkok, thaiShortDate, ymd,
} from "./thaiDate.mjs";

test("bangkokYmd flips the day at 17:00 UTC", () => {
    assert.equal(bangkokYmd(new Date("2026-10-13T16:59:59Z")), "2026-10-13");
    assert.equal(bangkokYmd(new Date("2026-10-13T17:00:00Z")), "2026-10-14");
    assert.equal(bangkokYmd(new Date("2026-12-31T17:30:00Z")), "2027-01-01");
});

test("addDays crosses months, leap days and years", () => {
    assert.equal(addDays("2026-03-01", -1), "2026-02-28");
    assert.equal(addDays("2024-03-01", -1), "2024-02-29");
    assert.equal(addDays("2026-01-01", -1), "2025-12-31");
    assert.equal(addDays("2026-10-14", -2), "2026-10-12");
});

test("isValidYmd and ymd", () => {
    assert.equal(isValidYmd(2026, 2, 29), false);
    assert.equal(isValidYmd(2024, 2, 29), true);
    assert.equal(isValidYmd(2026, 13, 1), false);
    assert.equal(isValidYmd(2026, 9, 31), false);
    assert.equal(isValidYmd(1800, 1, 1), false);
    assert.equal(ymd(2026, 3, 5), "2026-03-05");
});

test("noonBangkok matches the web's fromInputDate (12:00 local Thai time)", () => {
    assert.equal(noonBangkok("2026-10-14").toISOString(), "2026-10-14T05:00:00.000Z");
});

test("monthBounds covers the Thai calendar month", () => {
    const { start, end } = monthBounds("2026-12-15");
    assert.equal(start.toISOString(), "2026-11-30T17:00:00.000Z");
    assert.equal(end.toISOString(), "2026-12-31T17:00:00.000Z");
    assert.equal(monthKey("2026-12-15"), "2026-12");
});

test("minuteIndex counts whole minutes", () => {
    assert.equal(minuteIndex(new Date(120_000)), 2);
    assert.equal(minuteIndex(new Date(179_999)), 2);
});

test("Thai labels", () => {
    assert.equal(thaiShortDate("2026-10-13"), "13 ต.ค.");
    assert.equal(thaiShortDate("2025-12-31", true), "31 ธ.ค. 2568");
    assert.equal(dateLabel("2026-10-14", "2026-10-14"), "วันนี้ (14 ต.ค.)");
    assert.equal(dateLabel("2026-10-13", "2026-10-14"), "เมื่อวาน (13 ต.ค.)");
    assert.equal(dateLabel("2026-10-01", "2026-10-14"), "1 ต.ค.");
    assert.equal(dateLabel("2025-12-31", "2026-10-14"), "31 ธ.ค. 2568");
    assert.equal(monthLabel("2026-10-14"), "ต.ค. 2569");
});
```

- [ ] **Step 2: รันเทสต์ให้เห็นว่ายังไม่ผ่าน**

Run: `node --test api/_lib/categories.test.mjs api/_lib/thaiDate.test.mjs`
Expected: FAIL เพราะ `Cannot find module` (ถ้า Node แสดง warning `MODULE_TYPELESS_PACKAGE_JSON` ตอน import `src/constants/categories.js` ถือว่าปกติ)

- [ ] **Step 3: เขียนโค้ด**

`api/_lib/categories.mjs`
```js
// หมวดหมู่ฝั่ง server (ต้องตรงกับ src/constants/categories.js — มีเทสต์คุม)
// short = ชื่อบนปุ่มใน LINE (quick reply ยาวได้ไม่เกิน 20 ตัวอักษร)
export const CATEGORIES = [
    { key: "food", label: "อาหาร/เครื่องดื่ม", short: "อาหาร/เครื่องดื่ม", type: "expense" },
    { key: "travel", label: "เดินทาง", short: "เดินทาง", type: "expense" },
    { key: "shopping", label: "ช้อปปิ้ง", short: "ช้อปปิ้ง", type: "expense" },
    { key: "bills", label: "ค่าน้ำ/ไฟ/เน็ต/โทรศัพท์", short: "น้ำ/ไฟ/เน็ต/โทร", type: "expense" },
    { key: "housing", label: "ค่าที่พัก", short: "ค่าที่พัก", type: "expense" },
    { key: "health", label: "สุขภาพ", short: "สุขภาพ", type: "expense" },
    { key: "entertainment", label: "บันเทิง", short: "บันเทิง", type: "expense" },
    { key: "education", label: "การศึกษา", short: "การศึกษา", type: "expense" },
    { key: "other", label: "อื่นๆ", short: "อื่นๆ", type: "expense" },
    { key: "salary", label: "เงินเดือน", short: "เงินเดือน", type: "income" },
    { key: "bonus", label: "โบนัส", short: "โบนัส", type: "income" },
    { key: "freelance", label: "งานเสริม", short: "งานเสริม", type: "income" },
    { key: "income", label: "รายรับอื่นๆ", short: "รายรับอื่นๆ", type: "income" },
];

export const EXPENSE = CATEGORIES.filter((c) => c.type === "expense");
export const INCOME = CATEGORIES.filter((c) => c.type === "income");

export const categoryOf = (key) => CATEGORIES.find((c) => c.key === key) || null;
export const isCategory = (key) => categoryOf(key) !== null;
export const typeOf = (key) => categoryOf(key)?.type ?? "expense";
```

`api/_lib/thaiDate.mjs`
```js
// วันที่ตามเวลาไทย (UTC+7 ไม่มี daylight saving) — server ของ Vercel ใช้ UTC
// วันที่ส่งไปมาเป็น string "YYYY-MM-DD" เทียบมากน้อยด้วย < > ได้เลย
const OFFSET_MS = 7 * 60 * 60 * 1000;
const pad = (n) => String(n).padStart(2, "0");

export const TH_MONTHS_SHORT = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];

export const ymd = (y, m, d) => `${y}-${pad(m)}-${pad(d)}`;

export const bangkokYmd = (now) => new Date(now.getTime() + OFFSET_MS).toISOString().slice(0, 10);

export function addDays(date, days) {
    const d = new Date(`${date}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + days);
    return d.toISOString().slice(0, 10);
}

export function isValidYmd(y, m, d) {
    if (![y, m, d].every(Number.isInteger) || y < 1900 || y > 2100) return false;
    const dt = new Date(Date.UTC(y, m - 1, d));
    return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

// เก็บ date ของรายการเป็นเที่ยงวันเวลาไทย เหมือน fromInputDate ฝั่งเว็บ
export const noonBangkok = (date) => new Date(`${date}T12:00:00+07:00`);

export const monthKey = (date) => date.slice(0, 7);

export function monthBounds(date) {
    const [y, m] = date.split("-").map(Number);
    const [ny, nm] = m === 12 ? [y + 1, 1] : [y, m + 1];
    return {
        start: new Date(`${y}-${pad(m)}-01T00:00:00+07:00`),
        end: new Date(`${ny}-${pad(nm)}-01T00:00:00+07:00`),
    };
}

export const minuteIndex = (now) => Math.floor(now.getTime() / 60000);

export function thaiShortDate(date, withYear = false) {
    const [y, m, d] = date.split("-").map(Number);
    return `${d} ${TH_MONTHS_SHORT[m - 1]}${withYear ? ` ${y + 543}` : ""}`;
}

export function dateLabel(date, today) {
    if (date === today) return `วันนี้ (${thaiShortDate(date)})`;
    if (date === addDays(today, -1)) return `เมื่อวาน (${thaiShortDate(date)})`;
    return thaiShortDate(date, date.slice(0, 4) !== today.slice(0, 4));
}

export function monthLabel(date) {
    const [y, m] = date.split("-").map(Number);
    return `${TH_MONTHS_SHORT[m - 1]} ${y + 543}`;
}
```

- [ ] **Step 4: รันเทสต์ให้ผ่าน**

Run: `npm run test:server`
Expected: PASS ทุกเทสต์

- [ ] **Step 5: Commit**

```bash
git add api/_lib/categories.mjs api/_lib/categories.test.mjs api/_lib/thaiDate.mjs api/_lib/thaiDate.test.mjs
git commit -m "Add server-side categories and Bangkok date helpers" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 9: พจนานุกรมกลางและ `parseMessage`

**Files:**
- Create: `api/_lib/dictionary.mjs`, `api/_lib/parse.mjs`
- Test: `api/_lib/dictionary.test.mjs`, `api/_lib/parse.test.mjs`

**Interfaces:**
- Consumes: `typeOf`, `isCategory` (Task 8) และ `addDays`, `isValidYmd`, `ymd` (Task 8)
- Produces:
  - `WORDS_BY_CATEGORY`, `GLOBAL_WORDS` (`{ [word]: categoryKey }`)
  - `MAX_ITEMS = 10`, `MAX_AMOUNT = 1_000_000_000`, `MAX_NOTE = 100`, `LEARN_KEY_MAX = 30`
  - `normalize(text) → string`
  - `learnKey(note) → string` (ตัวพิมพ์เล็ก ตัดช่องว่าง ยาวไม่เกิน 30)
  - `matchCategory(note, personal = {}) → { category: string | null, source: "personal" | "global" | null }`
  - `parseMessage(text, { personal = {}, today }) → { date: string | null, items: [{ note, amount, type, category | null }], ignored: string | null, error: null | "invalid_date" | "future_date" | "too_many_items" | "amount_too_large" }`

  หมายเหตุ: field `ignored` เพิ่มจาก spec ใช้เก็บข้อความท้ายที่ไม่มีจำนวนเงิน (ดู Review Focus ข้อ 1) และ classifier ต้องมีช่องว่าง ตัวเลข เครื่องหมายวรรคตอน หรือจบข้อความตามหลัง (`ข้าว 2 จาน 100` ✓) เพื่อไม่ให้ `50 คนละครึ่ง` ถูกตัดตัวเลขทิ้ง

- [ ] **Step 1: เขียนเทสต์ที่ยังไม่ผ่าน**

`api/_lib/dictionary.test.mjs`
```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { GLOBAL_WORDS, WORDS_BY_CATEGORY } from "./dictionary.mjs";
import { isCategory } from "./categories.mjs";

test("every word is stored in matching form (lowercase, no spaces)", () => {
    for (const word of Object.keys(GLOBAL_WORDS)) assert.equal(word, word.toLowerCase().replace(/\s+/g, ""), word);
});

test("every category key is real", () => {
    for (const key of Object.keys(WORDS_BY_CATEGORY)) assert.ok(isCategory(key), key);
});

test("no word is listed under two categories", () => {
    const all = Object.values(WORDS_BY_CATEGORY).flat();
    const dupes = all.filter((w, i) => all.indexOf(w) !== i);
    assert.deepEqual(dupes, []);
});
```

`api/_lib/parse.test.mjs`
```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { learnKey, matchCategory, parseMessage } from "./parse.mjs";

const TODAY = "2026-10-14";
const parse = (text, personal = {}) => parseMessage(text, { personal, today: TODAY });
const rows = (text, personal) => parse(text, personal).items.map((it) => [it.note, it.amount, it.type, it.category]);

test("the spec example becomes three categorized expenses", () => {
    assert.deepEqual(rows("ค่าข้าวตอนกลางวัน 50 บาท ค่าน้ำ 100 บาท ค่าเน็ต 20 บาท"), [
        ["ค่าข้าวตอนกลางวัน", 50, "expense", "food"],
        ["ค่าน้ำ", 100, "expense", "bills"],
        ["ค่าเน็ต", 20, "expense", "bills"],
    ]);
    assert.equal(parse("ค่าข้าว 50").date, null);
});

const AMOUNTS = [
    ["ค่าข้าว 50", "ค่าข้าว", 50],
    ["ค่าข้าว50", "ค่าข้าว", 50],
    ["ค่าข้าว 50บ.", "ค่าข้าว", 50],
    ["ค่าข้าว 50 บ", "ค่าข้าว", 50],
    ["ค่าข้าว 50.-", "ค่าข้าว", 50],
    ["ค่าข้าว ฿50", "ค่าข้าว", 50],
    ["ค่าข้าว ๕๐ บาท", "ค่าข้าว", 50],
    ["ค่าข้าว 45.50", "ค่าข้าว", 45.5],
    ["ค่ากาแฟ 45.999", "ค่ากาแฟ", 46],
    ["ค่าเช่า 1.5k", "ค่าเช่า", 1500],
    ["เงินเดือน 25,000", "เงินเดือน", 25000],
    ["เงินเดือน 1,234,567.50", "เงินเดือน", 1234567.5],
    ["ค่าข้าว -50", "ค่าข้าว", 50],
    ["ข้าว 2 จาน 100", "ข้าว 2 จาน", 100],
    ["ซิม 5G 300", "ซิม 5G", 300],
    ["7-11 85", "7-11", 85],
    ["ประชุม 12:30 ค่ากาแฟ 60", "ประชุม 12:30 ค่ากาแฟ", 60],
];
for (const [text, note, amount] of AMOUNTS) {
    test(`amount: ${text}`, () => {
        const { items } = parse(text);
        assert.equal(items.length, 1);
        assert.equal(items[0].note, note);
        assert.equal(items[0].amount, amount);
    });
}

const CATEGORY_CASES = [
    ["ค่าน้ำมัน 500", "travel"],
    ["เติมน้ำมัน 500", "travel"],
    ["น้ำเปล่า 10", "food"],
    ["ซื้อน้ำ 20", "food"],
    ["ค่าน้ำ 100", "bills"],
    ["ค่าไฟฟ้า 900", "bills"],
    ["รถไฟฟ้า 42", "travel"],
    ["หนังสือ 300", "education"],
    ["ดูหนัง 220", "entertainment"],
    ["grab 120", "travel"],
    ["Grab Food 150", "food"],
    ["ค่าเช่ารถ 800", "travel"],
    ["ค่าเช่า 4500", "housing"],
    ["อาหารเสริม 500", "health"],
    ["ยาสีฟัน 45", "shopping"],
    ["ค่ายา 120", "health"],
    ["Netflix 419", "entertainment"],
    ["ค่าเทอม 15000", "education"],
    ["ทำบุญ 100", "other"],
    ["7-11 85", "food"],
];
for (const [text, category] of CATEGORY_CASES) {
    test(`category: ${text} → ${category}`, () => {
        assert.equal(parse(text).items[0].category, category);
    });
}

test("income is detected from the category, a ได้/รับ prefix or a + sign", () => {
    assert.deepEqual(rows("เงินเดือน 25000"), [["เงินเดือน", 25000, "income", "salary"]]);
    assert.deepEqual(rows("โบนัส 10000"), [["โบนัส", 10000, "income", "bonus"]]);
    assert.deepEqual(rows("ได้ค่าจ้าง 3000"), [["ได้ค่าจ้าง", 3000, "income", "freelance"]]);
    assert.deepEqual(rows("รับเงินคืน 200"), [["รับเงินคืน", 200, "income", "income"]]);
    assert.deepEqual(rows("+500 ขายของ"), [["ขายของ", 500, "income", "income"]]);
    assert.deepEqual(rows("เพื่อนคืนค่าข้าว +50"), [["เพื่อนคืนค่าข้าว", 50, "income", "income"]]);
    assert.deepEqual(rows("รับส่งลูก 1500"), [["รับส่งลูก", 1500, "income", null]]);
});

test("the personal dictionary wins over the global one and its type over the prefix", () => {
    assert.deepEqual(rows("ค่าแมว 300"), [["ค่าแมว", 300, "expense", null]]);
    assert.deepEqual(rows("ค่าแมว 300", { "ค่าแมว": "other" }), [["ค่าแมว", 300, "expense", "other"]]);
    assert.deepEqual(rows("จ่ายค่าแมวเดือนนี้ 300", { "ค่าแมว": "other" }), [["จ่ายค่าแมวเดือนนี้", 300, "expense", "other"]]);
    assert.deepEqual(rows("ค่าน้ำ 15", { "ค่าน้ำ": "food" }), [["ค่าน้ำ", 15, "expense", "food"]]);
    assert.deepEqual(rows("รับส่งลูก 1500", { "รับส่งลูก": "travel" }), [["รับส่งลูก", 1500, "expense", "travel"]]);
});

const DATES = [
    ["วันนี้ ค่าข้าว 50", "2026-10-14"],
    ["เมื่อวาน ค่าข้าว 50", "2026-10-13"],
    ["เมื่อวานซืน ค่าข้าว 50", "2026-10-12"],
    ["12/10 ค่าแท็กซี่ 120", "2026-10-12"],
    ["12/10/2569 ค่าข้าว 50", "2026-10-12"],
    ["12/10/2026 ค่าข้าว 50", "2026-10-12"],
    ["12 ต.ค. ค่าข้าว 50", "2026-10-12"],
    ["12 ตค ค่าข้าว 50", "2026-10-12"],
    ["12 ตุลาคม 2569 ค่าข้าว 50", "2026-10-12"],
    ["1 มีนาคม ค่าข้าว 50", "2026-03-01"],
    ["20/12 ค่าข้าว 50", "2025-12-20"],
    ["15/10 ค่าข้าว 50", "2025-10-15"],
    ["29/2/2567 ค่าข้าว 50", "2024-02-29"],
];
for (const [text, date] of DATES) {
    test(`date: ${text} → ${date}`, () => {
        const result = parse(text);
        assert.equal(result.error, null);
        assert.equal(result.date, date);
        assert.equal(result.items.length, 1);
    });
}

test("the text after a date becomes the note", () => {
    assert.deepEqual(rows("12/10 ค่าแท็กซี่ 120"), [["ค่าแท็กซี่", 120, "expense", "travel"]]);
});

test("bad dates are errors", () => {
    assert.equal(parse("15/10/2026 ค่าข้าว 50").error, "future_date");
    assert.equal(parse("31/9 ค่าข้าว 50").error, "invalid_date");
    assert.equal(parse("29/2/2026 ค่าข้าว 50").error, "invalid_date");
});

test("a word that only starts like a month is not a date", () => {
    assert.equal(parse("5 มีค่าใช้จ่าย 100").date, null);
});

test("item count and amount limits", () => {
    const many = (n) => Array.from({ length: n }, (_, i) => `ข้าว ${i + 1}`).join(" ");
    assert.equal(parse(many(10)).items.length, 10);
    assert.equal(parse(many(11)).error, "too_many_items");
    assert.equal(parse("บ้าน 1000000000").items[0].amount, 1_000_000_000);
    assert.equal(parse("บ้าน 2000000000").error, "amount_too_large");
});

test("no amount means no items; a date alone keeps the date", () => {
    assert.deepEqual(parse("สวัสดี"), { date: null, items: [], ignored: null, error: null });
    assert.deepEqual(parse("เมื่อวาน"), { date: "2026-10-13", items: [], ignored: null, error: null });
});

test("trailing text without an amount is reported as ignored", () => {
    const r = parse("ค่าข้าว 50 ค่าน้ำ");
    assert.deepEqual(r.items.map((it) => it.note), ["ค่าข้าว"]);
    assert.equal(r.ignored, "ค่าน้ำ");
    const r2 = parse("ค่าข้าว 50 คนละครึ่ง");
    assert.equal(r2.items[0].amount, 50);
    assert.equal(r2.ignored, "คนละครึ่ง");
});

test("amount-first messages use the text after each amount", () => {
    assert.deepEqual(rows("50 ค่าข้าว 100 ค่าน้ำ"), [
        ["ค่าข้าว", 50, "expense", "food"],
        ["ค่าน้ำ", 100, "expense", "bills"],
    ]);
});

test("separators, newlines and extra spaces are cleaned from notes", () => {
    const notes = (t) => parse(t).items.map((it) => it.note);
    assert.deepEqual(notes("ค่าข้าว 50\n\nค่าน้ำ   100"), ["ค่าข้าว", "ค่าน้ำ"]);
    assert.deepEqual(notes("ค่าข้าว 50, ค่าน้ำ 100"), ["ค่าข้าว", "ค่าน้ำ"]);
    assert.deepEqual(notes("ค่าข้าว 50 และ ค่าน้ำ 100"), ["ค่าข้าว", "ค่าน้ำ"]);
});

test("a bare amount has an empty note and no category; long notes are cut to 100", () => {
    assert.deepEqual(rows("50"), [["", 50, "expense", null]]);
    assert.equal(parse(`${"ก".repeat(150)} 50`).items[0].note.length, 100);
});

test("learnKey and matchCategory", () => {
    assert.equal(learnKey(" ค่า แมว "), "ค่าแมว");
    assert.equal(learnKey("ABC"), "abc");
    assert.equal(learnKey("ก".repeat(40)).length, 30);
    assert.deepEqual(matchCategory(""), { category: null, source: null });
    assert.deepEqual(matchCategory("ค่าน้ำ"), { category: "bills", source: "global" });
    assert.deepEqual(matchCategory("ค่าน้ำ", { "ค่าน้ำ": "food" }), { category: "food", source: "personal" });
});
```

- [ ] **Step 2: รันเทสต์ให้เห็นว่ายังไม่ผ่าน**

Run: `node --test api/_lib/dictionary.test.mjs api/_lib/parse.test.mjs`
Expected: FAIL เพราะ `Cannot find module`

- [ ] **Step 3: เขียนพจนานุกรม**

`api/_lib/dictionary.mjs`
```js
// พจนานุกรมกลาง: คำ (ตัวพิมพ์เล็ก ไม่มีช่องว่าง) แยกตามหมวด
// ระบบเลือก "คำที่ยาวที่สุด" ที่อยู่ในคำอธิบาย
// ถ้าสองคำยาวเท่ากันแต่คนละหมวดและอยู่ในข้อความเดียวกันได้ ให้เพิ่มคำรวมที่ยาวกว่าไว้ตรงๆ
// (เช่น "ค่าน้ำมัน" ชนกันระหว่าง "ค่าน้ำ" กับ "น้ำมัน") แล้วเพิ่มเทสต์ใน parse.test.mjs
export const WORDS_BY_CATEGORY = {
    food: [
        "ข้าว", "ข้าวเหนียว", "อาหาร", "มื้อ", "กับข้าว", "ก๋วยเตี๋ยว", "บะหมี่", "ราเมง", "ผัดไทย", "ส้มตำ",
        "ไก่ทอด", "หมูกระทะ", "ชาบู", "สุกี้", "บุฟเฟ่ต์", "ขนม", "ขนมปัง", "เบเกอรี่", "เค้ก", "ผลไม้",
        "กาแฟ", "คาเฟ่", "ชานม", "ชาไทย", "ชาเย็น", "ชาเขียว", "ชามะนาว", "โกโก้", "นม", "น้ำ",
        "น้ำเปล่า", "น้ำดื่ม", "น้ำแข็ง", "น้ำผลไม้", "น้ำอัดลม", "โค้ก", "ไอติม", "ไอศกรีม", "มาม่า", "น้ำมันพืช",
        "ตลาด", "เซเว่น", "7-11", "grabfood", "foodpanda", "lineman", "robinhood", "starbucks", "kfc", "mcdonald",
    ],
    travel: [
        "เดินทาง", "ค่าเดินทาง", "ค่ารถ", "รถเมล์", "รถไฟ", "รถตู้", "รถทัวร์", "รถไฟฟ้า", "bts", "mrt",
        "แท็กซี่", "taxi", "grab", "bolt", "วิน", "มอไซค์", "มอเตอร์ไซค์", "น้ำมัน", "ค่าน้ำมัน", "เติมน้ำมัน",
        "ทางด่วน", "ค่าผ่านทาง", "ที่จอดรถ", "ค่าจอดรถ", "เรือ", "เครื่องบิน", "ตั๋วเครื่องบิน", "ล้างรถ", "ซ่อมรถ", "เช่ารถ",
        "ค่าเช่ารถ",
    ],
    shopping: [
        "ช้อปปิ้ง", "ช้อป", "shopee", "lazada", "tiktokshop", "เสื้อ", "เสื้อผ้า", "กางเกง", "กระโปรง", "รองเท้า",
        "กระเป๋า", "เครื่องสำอาง", "ลิปสติก", "ครีม", "สบู่", "แชมพู", "ยาสีฟัน", "ผงซักฟอก", "ทิชชู่", "ของใช้",
        "ซื้อของ", "ห้าง", "หูฟัง", "ของขวัญ", "ตัดผม", "ทำผม", "ทำเล็บ",
    ],
    bills: [
        "ค่าน้ำ", "น้ำประปา", "ค่าไฟ", "ค่าไฟฟ้า", "ไฟฟ้า", "เน็ต", "ค่าเน็ต", "อินเทอร์เน็ต", "อินเตอร์เน็ต", "wifi",
        "ไวไฟ", "ค่าโทร", "ค่าโทรศัพท์", "โทรศัพท์", "ค่ามือถือ", "เติมเงิน", "ais", "dtac", "true", "3bb",
        "บัตรเครดิต",
    ],
    housing: [
        "ค่าเช่า", "ค่าเช่าห้อง", "ค่าห้อง", "ค่าหอ", "หอพัก", "ค่าคอนโด", "คอนโด", "ค่าบ้าน", "ผ่อนบ้าน", "ค่าส่วนกลาง",
        "เฟอร์นิเจอร์",
    ],
    health: [
        "ยา", "ค่ายา", "ร้านยา", "หมอ", "หาหมอ", "ค่าหมอ", "โรงพยาบาล", "โรงบาล", "คลินิก", "ทำฟัน",
        "หมอฟัน", "ทันตกรรม", "ตรวจสุขภาพ", "วิตามิน", "อาหารเสริม", "ฟิตเนส", "ยิม", "gym", "แว่นตา", "คอนแทคเลนส์",
    ],
    entertainment: [
        "บันเทิง", "หนัง", "ดูหนัง", "โรงหนัง", "ตั๋วหนัง", "คอนเสิร์ต", "เกม", "เติมเกม", "netflix", "เน็ตฟลิกซ์",
        "spotify", "youtube", "disney", "viu", "steam", "คาราโอเกะ", "เหล้า", "เบียร์", "ปาร์ตี้", "เที่ยว",
        "ทริป", "สวนสนุก", "หนังสือการ์ตูน",
    ],
    education: [
        "การศึกษา", "หนังสือ", "ค่าเทอม", "ค่าเรียน", "เรียนพิเศษ", "ติว", "คอร์ส", "course", "udemy", "เครื่องเขียน",
        "ปากกา", "สมุด", "ชีท", "ถ่ายเอกสาร",
    ],
    other: ["บริจาค", "ทำบุญ", "ใส่ซอง", "ซองงาน", "ให้แม่", "ให้พ่อ", "ให้ที่บ้าน", "ค่าธรรมเนียม", "ภาษี"],
    salary: ["เงินเดือน", "salary"],
    bonus: ["โบนัส", "bonus"],
    freelance: ["ฟรีแลนซ์", "freelance", "งานเสริม", "ค่าจ้าง", "คอมมิชชั่น"],
    income: [
        "รายได้", "รายรับ", "ขาย", "ขายของ", "ปันผล", "ดอกเบี้ย", "เงินคืน", "คืนเงิน", "ถูกหวย", "ถูกลอตเตอรี่",
        "แม่ให้", "พ่อให้", "ได้เงิน", "รับเงิน",
    ],
};

export const GLOBAL_WORDS = Object.freeze(
    Object.fromEntries(Object.entries(WORDS_BY_CATEGORY).flatMap(([key, words]) => words.map((w) => [w, key])))
);
```

- [ ] **Step 4: เขียนตัวแยกข้อความ**

`api/_lib/parse.mjs`
```js
import { GLOBAL_WORDS } from "./dictionary.mjs";
import { typeOf } from "./categories.mjs";
import { addDays, isValidYmd, ymd } from "./thaiDate.mjs";

export const MAX_ITEMS = 10;
export const MAX_AMOUNT = 1_000_000_000;
export const MAX_NOTE = 100;
export const LEARN_KEY_MAX = 30;

const THAI_DIGITS = "๐๑๒๓๔๕๖๗๘๙";

// เลขไทย -> อารบิก, ตัดจุลภาคหลักพัน, ช่องว่าง/ขึ้นบรรทัดหลายตัว -> ช่องว่างเดียว
export const normalize = (text) =>
    String(text || "")
        .replace(/[๐-๙]/g, (c) => String(THAI_DIGITS.indexOf(c)))
        .replace(/(\d),(?=\d{3}(?!\d))/g, "$1")
        .replace(/\s+/g, " ")
        .trim();

// ---------- วันที่ (ดูเฉพาะต้นข้อความ) ----------

const RELATIVE = [["เมื่อวานซืน", -2], ["เมื่อวาน", -1], ["วันนี้", 0]];
const MONTH_NAMES = [
    ["มกราคม", "ม.ค.", "มค"], ["กุมภาพันธ์", "ก.พ.", "กพ"], ["มีนาคม", "มี.ค.", "มีค"],
    ["เมษายน", "เม.ย.", "เมย"], ["พฤษภาคม", "พ.ค.", "พค"], ["มิถุนายน", "มิ.ย.", "มิย"],
    ["กรกฎาคม", "ก.ค.", "กค"], ["สิงหาคม", "ส.ค.", "สค"], ["กันยายน", "ก.ย.", "กย"],
    ["ตุลาคม", "ต.ค.", "ตค"], ["พฤศจิกายน", "พ.ย.", "พย"], ["ธันวาคม", "ธ.ค.", "ธค"],
];
const MONTH_VARIANTS = MONTH_NAMES.flatMap((names, i) => names.map((name) => ({ name, month: i + 1 }))).sort(
    (a, b) => b.name.length - a.name.length
);

function resolveDate(d, m, y, today, rest) {
    const thisYear = Number(today.slice(0, 4));
    let year = y === null ? thisYear : y > 2400 ? y - 543 : y; // ปีเกิน 2400 = พ.ศ.
    if (!isValidYmd(year, m, d)) return { error: "invalid_date" };
    let date = ymd(year, m, d);
    // ไม่ระบุปีแล้ววันนั้นยังมาไม่ถึง -> หมายถึงปีที่แล้ว
    if (y === null && date > today) {
        year -= 1;
        if (!isValidYmd(year, m, d)) return { error: "invalid_date" };
        date = ymd(year, m, d);
    }
    if (date > today) return { error: "future_date" };
    return { date, rest };
}

function leadingDate(s, today) {
    for (const [word, offset] of RELATIVE) {
        if (s.startsWith(word)) return { date: addDays(today, offset), rest: s.slice(word.length) };
    }
    const slash = s.match(/^(\d{1,2})\/(\d{1,2})(?:\/(\d{4}))?(?![\d/])/);
    if (slash) return resolveDate(+slash[1], +slash[2], slash[3] ? +slash[3] : null, today, s.slice(slash[0].length));

    const day = s.match(/^(\d{1,2}) ?/);
    if (!day) return null;
    const after = s.slice(day[0].length);
    for (const { name, month } of MONTH_VARIANTS) {
        if (!after.startsWith(name)) continue;
        let rest = after.slice(name.length);
        // ชื่อเดือนแบบไม่มีจุดต้องจบคำ ("มีค" ไม่ใช่ต้นของ "มีค่า...")
        if (!name.endsWith(".") && rest && !/^[\s\d]/.test(rest)) continue;
        const year = rest.match(/^ ?(\d{4})(?!\d)/);
        if (year) rest = rest.slice(year[0].length);
        return resolveDate(+day[1], month, year ? +year[1] : null, today, rest);
    }
    return null;
}

// ---------- จำนวนเงิน ----------

const CLASSIFIERS = [
    "จาน", "แก้ว", "ชิ้น", "ขวด", "ห่อ", "กล่อง", "คน", "ลิตร", "อัน", "ใบ", "ตัว", "เล่ม",
    "ถุง", "ชาม", "ลูก", "กิโล", "แพ็ค", "คู่", "วัน", "เดือน", "ปี",
];
const CURRENCY = /^ ?(?:บาท|บ\.|\.-|บ(?![฀-๿]))/;
const THOUSAND = /^ ?[kK](?![A-Za-z])/;

// ลักษณนามต้องตามด้วยช่องว่าง/ตัวเลข/วรรคตอน/จบข้อความ ("50 คนละครึ่ง" ไม่ใช่ลักษณนาม)
const startsWithClassifier = (rest) => {
    const r = rest.replace(/^ /, "");
    return CLASSIFIERS.some((c) => r.startsWith(c) && /^(?:$|[\s\d,.;:!?)\]])/.test(r.slice(c.length)));
};

function scanAmounts(s) {
    const tokens = [];
    for (const m of s.matchAll(/\d+(?:\.\d+)?/g)) {
        let start = m.index;
        let end = start + m[0].length;
        const before = s[start - 1] || "";
        // ติดตัวอักษร/ตัวเลข/จุด/เวลา/วันที่ข้างหน้า (A4, 12:30, 12/10) หรือเป็นท้ายของ 7-11
        if (/[A-Za-z0-9.:/]/.test(before)) continue;
        if (before === "-" && /\d/.test(s[start - 2] || "")) continue;
        let rest = s.slice(end);
        if (/^[:/-]\d/.test(rest)) continue;

        let value = Number(m[0]);
        let unit = false;
        const k = rest.match(THOUSAND);
        if (k) {
            value *= 1000;
            end += k[0].length;
            rest = s.slice(end);
            unit = true;
        }
        const cur = rest.match(CURRENCY);
        if (cur) {
            end += cur[0].length;
            unit = true;
        }
        if (!unit && (/^[A-Za-z]/.test(rest) || startsWithClassifier(rest))) continue; // 5G, 2 จาน

        let plus = false;
        if (s[start - 1] === "฿") start -= 1;
        if (s[start - 1] === "+") {
            plus = true;
            start -= 1;
        }
        value = Math.round(value * 100) / 100;
        if (value <= 0) continue;
        tokens.push({ start, end, value, plus });
    }
    return tokens;
}

// ---------- หมวด ----------

const SEPARATORS = /^(?:[\s,/+\-:;]|และ)+|(?:[\s,/+\-:;]|และ)+$/g;
const clean = (text) => text.replace(SEPARATORS, "").slice(0, MAX_NOTE);
const INCOME_PREFIX = /^(?:ได้|รับ)/;

export const learnKey = (note) => note.toLowerCase().replace(/\s+/g, "").slice(0, LEARN_KEY_MAX);

function longestMatch(words, key) {
    let best = null;
    let bestLength = 0;
    for (const [word, category] of Object.entries(words)) {
        if (word && word.length > bestLength && key.includes(word)) {
            best = category;
            bestLength = word.length;
        }
    }
    return best;
}

export function matchCategory(note, personal = {}) {
    const key = note.toLowerCase().replace(/\s+/g, "");
    if (!key) return { category: null, source: null };
    const mine = longestMatch(personal, key);
    if (mine) return { category: mine, source: "personal" };
    const global = longestMatch(GLOBAL_WORDS, key);
    if (global) return { category: global, source: "global" };
    return { category: null, source: null };
}

function buildItem(note, token, personal) {
    const { category: found, source } = matchCategory(note, personal);
    let category = found;
    let type = category ? typeOf(category) : "expense";
    // หมวดที่ผู้ใช้สอนเองชนะคำนำหน้า ได้/รับ แต่เครื่องหมาย + ชนะทุกอย่าง
    if (token.plus || (source !== "personal" && INCOME_PREFIX.test(note))) {
        type = "income";
        if (category && typeOf(category) === "expense") category = "income";
    }
    return { note, amount: token.value, type, category };
}

// ---------- รวม ----------

export function parseMessage(text, { personal = {}, today }) {
    const s = normalize(text);
    const lead = leadingDate(s, today);
    if (lead?.error) return { date: null, items: [], ignored: null, error: lead.error };
    const date = lead ? lead.date : null;
    const rest = lead ? lead.rest.trim() : s;

    const tokens = scanAmounts(rest);
    if (tokens.length === 0) return { date, items: [], ignored: null, error: null };
    if (tokens.length > MAX_ITEMS) return { date, items: [], ignored: null, error: "too_many_items" };
    if (tokens.some((t) => t.value > MAX_AMOUNT)) return { date, items: [], ignored: null, error: "amount_too_large" };

    // "50 ค่าข้าว 100 ค่าน้ำ" (ตัวเลขขึ้นก่อน) -> คำอธิบายอยู่หลังตัวเลข
    const amountFirst = clean(rest.slice(0, tokens[0].start)) === "";
    const items = tokens.map((t, k) => {
        const from = amountFirst ? t.end : k === 0 ? 0 : tokens[k - 1].end;
        const to = amountFirst ? (tokens[k + 1]?.start ?? rest.length) : t.start;
        return buildItem(clean(rest.slice(from, to)), t, personal);
    });
    const tail = amountFirst ? "" : clean(rest.slice(tokens[tokens.length - 1].end));
    return { date, items, ignored: tail || null, error: null };
}
```

- [ ] **Step 5: รันเทสต์ให้ผ่าน**

Run: `npm run test:server`
Expected: PASS ทุกเทสต์ ถ้าเทสต์หมวดตัวไหนไม่ผ่าน ให้ดูว่าคำไหนยาวที่สุดที่ match ได้ แล้วแก้ที่พจนานุกรม (เพิ่มคำรวม) ห้ามแก้เทสต์ให้ตรงกับผลที่ผิด

- [ ] **Step 6: Commit**

```bash
git add api/_lib/dictionary.mjs api/_lib/dictionary.test.mjs api/_lib/parse.mjs api/_lib/parse.test.mjs
git commit -m "Add Thai message parser and global category dictionary" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

# ช่วงที่ 3: บอท

### Task 10: postback และตัวจำกัดการใช้งาน

**Files:**
- Create: `api/_lib/postback.mjs`, `api/_lib/rateLimit.mjs`
- Test: `api/_lib/postback.test.mjs`, `api/_lib/rateLimit.test.mjs`

**Interfaces:**
- Produces:
  - `encodePostback(fields) → string` (ข้าม field ที่เป็น `undefined`/`null` และโยน error ถ้ายาวเกิน 300)
  - `decodePostback(data) → Record<string, string>`
  - `decideQuota(usage | undefined, { today, minute, limits }) → { decision: "ok" | "warnMinute" | "warnDay" | "silent", next: object | null }`
- ฟิลด์ใน postback: `a` (action), `d` (draftId), `i` (index), `c` (category), `v` (`today` | `yesterday` | `pick`), `k` (`income` | `expense`), `m` (`pick` | `fix`)

- [ ] **Step 1: เขียนเทสต์ที่ยังไม่ผ่าน**

`api/_lib/postback.test.mjs`
```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { decodePostback, encodePostback } from "./postback.mjs";

test("postback data round-trips and drops empty fields", () => {
    const data = encodePostback({ a: "cat", d: "123456789012345678", i: 3, c: "food", v: undefined, k: null });
    assert.equal(data, "a=cat&d=123456789012345678&i=3&c=food");
    assert.deepEqual(decodePostback(data), { a: "cat", d: "123456789012345678", i: "3", c: "food" });
    assert.deepEqual(decodePostback(""), {});
});

test("postback data longer than LINE's 300 characters is refused", () => {
    assert.throws(() => encodePostback({ a: "x".repeat(400) }));
});
```

`api/_lib/rateLimit.test.mjs`
```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { decideQuota } from "./rateLimit.mjs";

const limits = { perMinute: 2, perDay: 3 };
const ctx = (minute, today = "2026-10-14") => ({ today, minute, limits });

function runMany(decisions, usage, contexts) {
    for (const c of contexts) {
        const { decision, next } = decideQuota(usage, c);
        decisions.push(decision);
        if (next) usage = next;
    }
    return usage;
}

test("counts per minute: warn once, then silent, then reset next minute", () => {
    const seen = [];
    runMany(seen, undefined, [ctx(1), ctx(1), ctx(1), ctx(1), ctx(2)]);
    assert.deepEqual(seen, ["ok", "ok", "warnMinute", "silent", "ok"]);
});

test("counts per day: warn once, then silent, then reset the next day", () => {
    const seen = [];
    runMany(seen, undefined, [ctx(1), ctx(2), ctx(3), ctx(4), ctx(5), ctx(6, "2026-10-15")]);
    assert.deepEqual(seen, ["ok", "ok", "ok", "warnDay", "silent", "ok"]);
});

test("silent decisions write nothing", () => {
    const usage = { day: "2026-10-14", dayCount: 3, minute: 9, minuteCount: 0, warnedDay: true, warnedMinute: false };
    assert.deepEqual(decideQuota(usage, ctx(9)), { decision: "silent", next: null });
});

test("per-user overrides beat the defaults; 0 suspends the bot", () => {
    assert.equal(decideQuota({ limitPerDay: 0 }, ctx(1)).decision, "warnDay");
    const { next } = decideQuota({ limitPerMinute: 1 }, ctx(1));
    assert.equal(decideQuota(next, ctx(1)).decision, "warnMinute");
    assert.equal(next.limitPerMinute, 1);
});
```

- [ ] **Step 2: รันเทสต์ให้เห็นว่ายังไม่ผ่าน**

Run: `node --test api/_lib/postback.test.mjs api/_lib/rateLimit.test.mjs`
Expected: FAIL เพราะ `Cannot find module`

- [ ] **Step 3: เขียนโค้ด**

`api/_lib/postback.mjs`
```js
// ข้อมูลที่ฝังในปุ่ม (postback.data) — LINE จำกัดไม่เกิน 300 ตัวอักษร
export const MAX_POSTBACK = 300;

export function encodePostback(fields) {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(fields)) {
        if (value !== undefined && value !== null) params.set(key, String(value));
    }
    const data = params.toString();
    if (data.length > MAX_POSTBACK) throw new Error(`postback data too long (${data.length})`);
    return data;
}

export const decodePostback = (data) => Object.fromEntries(new URLSearchParams(data || ""));
```

`api/_lib/rateLimit.mjs`
```js
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
```

- [ ] **Step 4: รันเทสต์ให้ผ่าน**

Run: `npm run test:server`
Expected: PASS ทุกเทสต์

- [ ] **Step 5: Commit**

```bash
git add api/_lib/postback.mjs api/_lib/postback.test.mjs api/_lib/rateLimit.mjs api/_lib/rateLimit.test.mjs
git commit -m "Add postback encoding and per-user rate limit decisions" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 11: ข้อความและการ์ดของ LINE

**Files:**
- Create: `api/_lib/messages.mjs`
- Test: `api/_lib/messages.test.mjs`

**Interfaces:**
- Consumes: `CATEGORIES`, `EXPENSE`, `INCOME`, `categoryOf` (Task 8), `dateLabel`, `monthLabel` (Task 8) และ `encodePostback` (Task 10)
- Produces (ทุกตัวคืน LINE message object):
  - `MSG` (ข้อความคงที่ และฟังก์ชัน `MSG.undone(n)`, `MSG.savedOne(note)`)
  - `baht(n)`, `clip(s, max)`
  - `textMessage(text, quickReply?)`, `helpMessage(lead?)`, `notLinkedMessage(webUrl)`, `welcomeMessage(linked, webUrl)`, `limitMessage(decision, webUrl)`
  - `errorText(code)`, `statusText(status)`
  - `dateCard(draftId, draft, today)`, `summaryCard(draftId, draft, today)`
  - `categoryQuickReply({ draftId, index, item, kind, mode, lead? })` โดย `mode` เป็น `"pick"` (ส่ง `cat` และมีปุ่ม "ไม่บันทึก") หรือ `"fix"` (ส่ง `fixcat`)
  - `fixItemsQuickReply(draftId, draft)`
  - `monthSummaryMessage({ today, income, expense, budget, webUrl })`
- รูปแบบของ draft ที่ใช้ทุกที่: `{ userId, date: "YYYY-MM-DD" | null, status: "awaitingDate" | "open" | "undone" | "cancelled", ignored: string | null, items: [{ note, amount, type, category | null, state: "pending" | "saved" | "skipped", txId: string | null }], createdAt: Date, expiresAt: Date, version: number }`

- [ ] **Step 1: เขียนเทสต์ที่ยังไม่ผ่าน**

`api/_lib/messages.test.mjs`
```js
import { test } from "node:test";
import assert from "node:assert/strict";
import {
    MSG, baht, categoryQuickReply, dateCard, errorText, fixItemsQuickReply, helpMessage, limitMessage,
    monthSummaryMessage, notLinkedMessage, statusText, summaryCard, welcomeMessage,
} from "./messages.mjs";

const TODAY = "2026-10-14";
const ID = "123456789012345678";
const item = (over = {}) => ({ note: "ค่าข้าว", amount: 50, type: "expense", category: "food", state: "pending", txId: null, ...over });
const draft = (items, over = {}) => ({ userId: "u1", date: null, status: "awaitingDate", ignored: null, items, version: 0, ...over });
const str = (m) => JSON.stringify(m);
const findAll = (node, pred, out = []) => {
    if (node && typeof node === "object") {
        if (pred(node)) out.push(node);
        for (const v of Object.values(node)) findAll(v, pred, out);
    }
    return out;
};

test("baht formats Thai thousands and up to 2 decimals", () => {
    assert.equal(baht(1234.5), "1,234.5");
    assert.equal(baht(-1000), "-1,000");
});

test("quick replies stay within LINE limits for every kind and mode", () => {
    const long = item({ note: "ค่าอาหารแมวยี่ห้อพิเศษราคาแพงมากๆ" });
    for (const kind of ["expense", "income"]) {
        for (const mode of ["pick", "fix"]) {
            const msg = categoryQuickReply({ draftId: ID, index: 9, item: long, kind, mode });
            assert.ok(msg.quickReply.items.length <= 13);
            for (const { action } of msg.quickReply.items) {
                assert.ok(action.label.length <= 20, action.label);
                assert.ok(action.data.length <= 300);
            }
        }
    }
    assert.equal(categoryQuickReply({ draftId: ID, index: 0, item: long, kind: "expense", mode: "pick" }).quickReply.items.length, 11);
    assert.equal(categoryQuickReply({ draftId: ID, index: 0, item: long, kind: "income", mode: "pick" }).quickReply.items.length, 6);
    assert.equal(categoryQuickReply({ draftId: ID, index: 0, item: long, kind: "expense", mode: "fix" }).quickReply.items.length, 10);
});

test("pick mode sends cat and has a skip button; fix mode sends fixcat and no skip", () => {
    const pick = str(categoryQuickReply({ draftId: ID, index: 2, item: item(), kind: "expense", mode: "pick" }));
    assert.match(pick, /a=cat&d=123456789012345678&i=2&c=food/);
    assert.match(pick, /a=skip/);
    assert.match(pick, /a=types&d=123456789012345678&i=2&k=income&m=pick/);
    const fix = str(categoryQuickReply({ draftId: ID, index: 2, item: item(), kind: "income", mode: "fix" }));
    assert.match(fix, /a=fixcat&d=123456789012345678&i=2&c=salary/);
    assert.doesNotMatch(fix, /a=skip/);
    assert.match(fix, /k=expense&m=fix/);
});

test("the category question names the item and can carry a lead line", () => {
    const msg = categoryQuickReply({ draftId: ID, index: 0, item: item({ note: "ค่าแมว", amount: 300 }), kind: "expense", mode: "pick", lead: MSG.savedOne("ค่าข้าว") });
    assert.equal(msg.text, "✓ บันทึก “ค่าข้าว” แล้ว\nเลือกหมวดของ “ค่าแมว 300 บาท”");
});

test("fixItemsQuickReply lists only saved items with clipped labels", () => {
    const d = draft([item({ state: "saved", txId: "t1", note: "ค่าอาหารแมวยี่ห้อพิเศษราคาแพงมากๆ" }), item({ state: "pending" })], { status: "open", date: TODAY });
    const msg = fixItemsQuickReply(ID, d);
    assert.equal(msg.quickReply.items.length, 1);
    assert.ok(msg.quickReply.items[0].action.label.length <= 20);
    assert.match(msg.quickReply.items[0].action.data, /a=fix&d=123456789012345678&i=0/);
});

test("dateCard lists items, flags unknown categories and ignored text, and limits the picker to today", () => {
    const d = draft([item(), item({ note: "ค่าแมว", amount: 300, category: null })], { ignored: "ค่าน้ำ" });
    const card = dateCard(ID, d, TODAY);
    const s = str(card);
    assert.equal(card.type, "flex");
    assert.match(card.altText, /2 รายการ · รวม 350 บาท/);
    assert.match(s, /\? ยังไม่รู้หมวด/);
    assert.match(s, /ไม่ได้บันทึก: “ค่าน้ำ” \(ไม่มีจำนวนเงิน\)/);
    assert.match(s, /เป็นของวันไหน\?/);
    const [picker] = findAll(card, (n) => n.type === "datetimepicker");
    assert.deepEqual([picker.mode, picker.initial, picker.max], ["date", TODAY, TODAY]);
    assert.match(s, /a=date&d=123456789012345678&v=today/);
    assert.match(s, /a=date&d=123456789012345678&v=yesterday/);
    assert.match(s, /a=cancel&d=123456789012345678/);
});

test("summaryCard shows saved items, ask buttons for pending ones and fix/undo only when something is saved", () => {
    const d = draft(
        [item({ state: "saved", txId: "t1" }), item({ note: "ค่าแมว", amount: 300, category: null, state: "pending" }), item({ note: "ขนม", amount: 20, state: "skipped" })],
        { status: "open", date: TODAY }
    );
    const s = str(summaryCard(ID, d, TODAY));
    assert.match(s, /✓ บันทึกแล้ว 1 รายการ · วันนี้ \(14 ต\.ค\.\) · รวม 50 บาท/);
    assert.match(s, /a=ask&d=123456789012345678&i=1/);
    assert.match(s, /ไม่บันทึก: ขนม 20/);
    assert.match(s, /a=fix&d=123456789012345678/);
    assert.match(s, /a=undo&d=123456789012345678/);

    const none = str(summaryCard(ID, draft([item({ category: null })], { status: "open", date: TODAY }), TODAY));
    assert.match(none, /รอเลือกหมวด · วันนี้/);
    assert.doesNotMatch(none, /a=undo/);
});

test("monthSummaryMessage shows totals, budget use and a web button", () => {
    const under = str(monthSummaryMessage({ today: TODAY, income: 3000, expense: 5000, budget: 10000, webUrl: "https://app.test" }));
    assert.match(under, /สรุป ต\.ค\. 2569/);
    assert.match(under, /รายรับ 3,000 บาท/);
    assert.match(under, /รายจ่าย 5,000 บาท/);
    assert.match(under, /คงเหลือ -2,000 บาท/);
    assert.match(under, /ใช้ไป 50% ของงบ เหลือ 5,000 บาท/);
    assert.match(under, /https:\/\/app\.test\/dashboard/);
    assert.match(str(monthSummaryMessage({ today: TODAY, income: 0, expense: 12000, budget: 10000, webUrl: "w" })), /เกินงบ 2,000 บาท/);
    assert.doesNotMatch(str(monthSummaryMessage({ today: TODAY, income: 0, expense: 1, budget: 0, webUrl: "w" })), /งบ/);
});

test("fixed messages", () => {
    assert.match(helpMessage().text, /ค่าข้าว 50/);
    assert.match(helpMessage(MSG.noAmount).text, /^ไม่พบจำนวนเงินในข้อความ\n\n/);
    assert.match(str(notLinkedMessage("https://app.test")), /https:\/\/app\.test\//);
    assert.equal(welcomeMessage(true, "w").type, "text");
    assert.match(str(welcomeMessage(false, "https://app.test")), /เชื่อมบัญชี/);
    assert.equal(limitMessage("warnMinute", "w").text, "ส่งเร็วเกินไป รอสักครู่แล้วลองใหม่");
    assert.match(str(limitMessage("warnDay", "https://app.test")), /วันนี้ใช้ครบแล้ว.*https:\/\/app\.test\/dashboard/);
    for (const code of ["invalid_date", "future_date", "too_many_items", "amount_too_large"]) assert.ok(errorText(code).length > 0);
    assert.equal(statusText("open"), "บันทึกไปแล้ว");
    assert.equal(statusText("undone"), "เลิกทำไปแล้ว");
    assert.equal(statusText("cancelled"), "ยกเลิกไปแล้ว");
    assert.equal(MSG.undone(2), "เลิกทำแล้ว ลบ 2 รายการ");
});
```

- [ ] **Step 2: รันเทสต์ให้เห็นว่ายังไม่ผ่าน**

Run: `node --test api/_lib/messages.test.mjs`
Expected: FAIL เพราะ `Cannot find module`

- [ ] **Step 3: เขียนโค้ด**

`api/_lib/messages.mjs`
```js
import { EXPENSE, INCOME, categoryOf } from "./categories.mjs";
import { dateLabel, monthLabel } from "./thaiDate.mjs";
import { encodePostback } from "./postback.mjs";

// ข้อความที่บอทตอบ (Flex Message สำหรับการ์ดที่ปุ่มต้องค้างอยู่ในแชท, quick reply สำหรับเลือกหมวด)
// https://developers.line.biz/en/reference/messaging-api/#message-objects

export const baht = (n) => Number(n).toLocaleString("th-TH", { maximumFractionDigits: 2 });
export const clip = (s, max) => (s.length <= max ? s : `${s.slice(0, max - 1)}…`);
const MUTED = "#6b7280";

export const MSG = {
    noAmount: "ไม่พบจำนวนเงินในข้อความ",
    notFound: "ไม่พบรายการนี้",
    expired: "รายการนี้หมดอายุแล้ว พิมพ์ใหม่อีกครั้ง",
    badDate: "เลือกวันที่ไม่เกินวันนี้",
    badCategory: "ไม่พบหมวดนี้ ลองเลือกใหม่อีกครั้ง",
    cancelled: "ยกเลิกแล้ว ไม่ได้บันทึกรายการ",
    alreadyDone: "รายการนี้จัดการไปแล้ว",
    nothingSaved: "ยังไม่มีรายการที่บันทึก",
    txGone: "รายการนี้ถูกลบไปแล้ว แต่ระบบจำหมวดของคำนี้ไว้ให้แล้ว",
    conflict: "มีการกดซ้อนกัน ลองใหม่อีกครั้ง",
    systemError: "ขออภัย ระบบขัดข้อง ลองใหม่อีกครั้ง",
    tooFast: "ส่งเร็วเกินไป รอสักครู่แล้วลองใหม่",
    dayLimit: "วันนี้ใช้ครบแล้ว จดต่อได้ที่เว็บ",
    undone: (n) => `เลิกทำแล้ว ลบ ${n} รายการ`,
    savedOne: (note) => `✓ บันทึก “${note || "(ไม่มีชื่อ)"}” แล้ว`,
};

const ERRORS = {
    invalid_date: "วันที่ไม่ถูกต้อง ลองพิมพ์ใหม่ เช่น 12/10 ค่าข้าว 50",
    future_date: "บันทึกล่วงหน้าไม่ได้ ใส่วันที่ไม่เกินวันนี้",
    too_many_items: "ส่งได้ครั้งละไม่เกิน 10 รายการ ลองแยกเป็นหลายข้อความ",
    amount_too_large: "จำนวนเงินต้องไม่เกิน 1,000,000,000 บาท",
};
export const errorText = (code) => ERRORS[code] || MSG.systemError;

const STATUS = {
    awaitingDate: "รายการนี้ยังไม่ได้เลือกวัน",
    open: "บันทึกไปแล้ว",
    undone: "เลิกทำไปแล้ว",
    cancelled: "ยกเลิกไปแล้ว",
};
export const statusText = (status) => STATUS[status] || MSG.notFound;

export const textMessage = (text, quickReply) => (quickReply ? { type: "text", text, quickReply } : { type: "text", text });

const HELP = [
    "พิมพ์รายการพร้อมจำนวนเงิน เช่น",
    "• ค่าข้าว 50",
    "• ค่าข้าวกลางวัน 50 บาท ค่าน้ำ 100 ค่าเน็ต 20",
    "• เมื่อวาน ค่าแท็กซี่ 120",
    "• 12/10 เงินเดือน 25000",
    "พิมพ์ “สรุป” เพื่อดูยอดเดือนนี้",
].join("\n");
export const helpMessage = (lead) => textMessage(lead ? `${lead}\n\n${HELP}` : HELP);

// ---------- ชิ้นส่วน Flex ----------

const postbackAction = (label, fields, displayText = label) => ({
    type: "postback",
    label,
    data: encodePostback(fields),
    displayText,
});
const uriAction = (label, uri) => ({ type: "uri", label, uri });
const button = (action, style = "secondary") => ({ type: "button", style, height: "sm", action });
const text = (value, extra = {}) => ({ type: "text", text: value, wrap: true, ...extra });
const row = (contents) => ({ type: "box", layout: "horizontal", spacing: "sm", contents });
const bubble = (altText, body, footer) => ({
    type: "flex",
    altText: clip(altText, 400),
    contents: {
        type: "bubble",
        body: { type: "box", layout: "vertical", spacing: "sm", contents: body },
        ...(footer ? { footer: { type: "box", layout: "vertical", spacing: "sm", contents: footer } } : {}),
    },
});
const linkCard = (message, label, uri) => bubble(message, [text(message)], [button(uriAction(label, uri), "primary")]);

export const notLinkedMessage = (webUrl) =>
    linkCard(
        "ยังไม่ได้เชื่อมบัญชี LINE กับแอป\nเข้าสู่ระบบด้วย LINE ที่หน้าเว็บก่อน แล้วกลับมาจดในแชทนี้ได้เลย",
        "เข้าสู่ระบบ / เชื่อมบัญชี",
        `${webUrl}/`
    );

export const welcomeMessage = (linked, webUrl) =>
    linked
        ? textMessage(`สวัสดี! เริ่มจดได้เลย\n\n${HELP}`)
        : linkCard("สวัสดี! บอทนี้ช่วยจดรายรับ-รายจ่ายจากแชท\nเชื่อมบัญชีที่หน้าเว็บก่อนเริ่มใช้", "เข้าสู่ระบบ / เชื่อมบัญชี", `${webUrl}/`);

export const limitMessage = (decision, webUrl) =>
    decision === "warnMinute" ? textMessage(MSG.tooFast) : linkCard(MSG.dayLimit, "เปิดเว็บ", `${webUrl}/dashboard`);

// ---------- รายการ ----------

const noteOf = (it) => it.note || "(ไม่มีชื่อ)";
const signed = (it) => `${it.type === "income" ? "+" : ""}${baht(it.amount)}`;
const sumOf = (items) => items.reduce((sum, it) => sum + it.amount, 0);
const categoryText = (it) => (it.category ? categoryOf(it.category)?.label ?? it.category : "? ยังไม่รู้หมวด");
const itemRow = (it) => ({
    type: "box",
    layout: "vertical",
    contents: [
        row([text(noteOf(it), { size: "sm", flex: 5 }), text(signed(it), { size: "sm", flex: 3, align: "end" })]),
        text(categoryText(it), { size: "xs", color: MUTED }),
    ],
});
const ignoredLine = (draft) =>
    draft.ignored ? [text(`ไม่ได้บันทึก: “${draft.ignored}” (ไม่มีจำนวนเงิน)`, { size: "xs", color: MUTED })] : [];

export function dateCard(draftId, draft, today) {
    const title = `${draft.items.length} รายการ · รวม ${baht(sumOf(draft.items))} บาท`;
    const body = [
        text(title, { weight: "bold" }),
        ...draft.items.map(itemRow),
        ...ignoredLine(draft),
        text("เป็นของวันไหน?", { weight: "bold", margin: "md" }),
    ];
    const footer = [
        row([
            button(postbackAction("วันนี้", { a: "date", d: draftId, v: "today" }), "primary"),
            button(postbackAction("เมื่อวาน", { a: "date", d: draftId, v: "yesterday" }), "primary"),
        ]),
        button({
            type: "datetimepicker",
            label: "เลือกวัน…",
            data: encodePostback({ a: "date", d: draftId, v: "pick" }),
            mode: "date",
            initial: today,
            max: today,
        }),
        button(postbackAction("ยกเลิก", { a: "cancel", d: draftId }), "link"),
    ];
    return bubble(`${title} — เลือกวันที่`, body, footer);
}

export function summaryCard(draftId, draft, today) {
    const saved = draft.items.filter((it) => it.state === "saved");
    const when = dateLabel(draft.date, today);
    const title = saved.length
        ? `✓ บันทึกแล้ว ${saved.length} รายการ · ${when} · รวม ${baht(sumOf(saved))} บาท`
        : `รอเลือกหมวด · ${when}`;
    const body = [text(title, { weight: "bold" })];
    draft.items.forEach((it, i) => {
        if (it.state === "saved") body.push(itemRow(it));
        if (it.state === "pending") {
            body.push(
                row([
                    text(`? ${noteOf(it)} ${signed(it)}`, { size: "sm", flex: 5, gravity: "center" }),
                    { ...button(postbackAction("เลือกหมวด", { a: "ask", d: draftId, i }, `เลือกหมวด: ${noteOf(it)}`)), flex: 4 },
                ])
            );
        }
        if (it.state === "skipped") body.push(text(`ไม่บันทึก: ${noteOf(it)} ${signed(it)}`, { size: "xs", color: MUTED }));
    });
    body.push(...ignoredLine(draft));
    const footer = saved.length
        ? [row([button(postbackAction("แก้หมวด", { a: "fix", d: draftId })), button(postbackAction("เลิกทำ", { a: "undo", d: draftId }))])]
        : null;
    return bubble(title, body, footer);
}

export function categoryQuickReply({ draftId, index, item, kind, mode, lead }) {
    const action = mode === "fix" ? "fixcat" : "cat";
    const cats = kind === "income" ? INCOME : EXPENSE;
    const actions = cats.map((c) => postbackAction(c.short, { a: action, d: draftId, i: index, c: c.key }, `หมวด: ${c.label}`));
    const other = kind === "income" ? "expense" : "income";
    actions.push(postbackAction(other === "income" ? "รายรับ…" : "รายจ่าย…", { a: "types", d: draftId, i: index, k: other, m: mode }));
    if (mode === "pick") actions.push(postbackAction("ไม่บันทึก", { a: "skip", d: draftId, i: index }, `ไม่บันทึก: ${noteOf(item)}`));
    const ask = `${mode === "fix" ? "แก้หมวด" : "เลือกหมวด"}ของ “${noteOf(item)} ${baht(item.amount)} บาท”`;
    return textMessage(lead ? `${lead}\n${ask}` : ask, { items: actions.map((a) => ({ type: "action", action: a })) });
}

export function fixItemsQuickReply(draftId, draft) {
    const items = [];
    draft.items.forEach((it, i) => {
        if (it.state !== "saved") return;
        const label = clip(`${noteOf(it)} ${baht(it.amount)}`, 20);
        items.push({ type: "action", action: postbackAction(label, { a: "fix", d: draftId, i }, `แก้หมวด: ${noteOf(it)}`) });
    });
    return textMessage("จะแก้หมวดของรายการไหน?", { items });
}

export function monthSummaryMessage({ today, income, expense, budget, webUrl }) {
    const lines = [
        `สรุป ${monthLabel(today)}`,
        `รายรับ ${baht(income)} บาท`,
        `รายจ่าย ${baht(expense)} บาท`,
        `คงเหลือ ${baht(income - expense)} บาท`,
    ];
    if (budget > 0) {
        lines.push(
            expense <= budget
                ? `ใช้ไป ${Math.round((expense / budget) * 100)}% ของงบ เหลือ ${baht(budget - expense)} บาท`
                : `เกินงบ ${baht(expense - budget)} บาท`
        );
    }
    const [head, ...rest] = lines;
    return bubble(
        lines.join("\n"),
        [text(head, { weight: "bold" }), ...rest.map((line) => text(line, { size: "sm" }))],
        [button(uriAction("เปิดเว็บ", `${webUrl}/dashboard`), "primary")]
    );
}
```

- [ ] **Step 4: รันเทสต์ให้ผ่าน**

Run: `npm run test:server`
Expected: PASS ทุกเทสต์

- [ ] **Step 5: Commit**

```bash
git add api/_lib/messages.mjs api/_lib/messages.test.mjs
git commit -m "Add LINE message, card and quick reply builders" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 12: บอทฝั่งข้อความ (`handleEvent` ส่วน follow, text, สรุป และตัวจำกัด)

**Files:**
- Create: `api/_lib/bot.mjs`
- Modify: `api/_lib/testing/fakes.mjs` (ต่อท้าย `createFakeStore`)
- Test: `api/_lib/bot.test.mjs`

**Interfaces:**
- Consumes: `parseMessage`, `learnKey` (Task 9) · `decodePostback` (Task 10) · `decideQuota` (Task 10 ใช้ใน fake store) · ทุกอย่างใน `messages.mjs` (Task 11) · `addDays`, `bangkokYmd`, `minuteIndex`, `monthBounds`, `monthKey`, `noonBangkok` (Task 8) · `isCategory`, `typeOf` (Task 8)
- Produces:
  - `handleEvent(event, { store, now: Date, limits, webUrl }) → Promise<message[]>` (คืน `[]` แปลว่าไม่ต้องตอบ) และค่าคงที่ `DRAFT_TTL_MS`, `MAX_WORDS = 500`
  - **Store interface** (ทั้ง Firestore ใน Task 14 และ fake ต้องมี method ครบตามนี้):
    - `findLink(lineUserId) → Promise<{ userId, displayName } | null>`
    - `consumeQuota(uid, { today, minute, limits }) → Promise<"ok" | "warnMinute" | "warnDay" | "silent">`
    - `getWords(uid) → Promise<Record<word, categoryKey>>`
    - `deleteExpiredDrafts(uid, now) → Promise<void>`
    - `createDraft(id, draft) → Promise<boolean>` (คืน `false` ถ้ามีอยู่แล้ว)
    - `getDraft(id) → Promise<draft | null>` (`createdAt`/`expiresAt` เป็น `Date`)
    - `newTxId() → string`
    - `applyDraft(id, expectedVersion, ops) → Promise<{ ok: boolean, missing: string[] }>`
      - `ops = { draft, creates: [{ id, data }], updates: [{ id, data }], deletes: [txId], learn: { uid, word, category } | null }`
      - ทำทุกอย่างใน transaction เดียว ถ้า version ไม่ตรงคืน `{ ok: false }` และเมื่อสำเร็จต้องเขียน `version: expectedVersion + 1`
    - `monthTotals(uid, start, end) → Promise<{ income, expense }>`
    - `getBudget(uid, "YYYY-MM") → Promise<number>`
  - `createFakeStore({ links, words, budgets }) → store` ซึ่งเปิดให้ดูข้างในได้ผ่าน `links`, `words`, `drafts: Map`, `txs: Map`, `usage: Map`, `budgets`, `quotaCalls`, `failNextApply`

- [ ] **Step 1: แก้ `api/_lib/testing/fakes.mjs`**

เพิ่มบรรทัดนี้เป็นบรรทัดแรกของไฟล์ (เหนือคอมเมนต์หัวไฟล์):

```js
import { decideQuota } from "../rateLimit.mjs";
```

แล้วต่อท้ายไฟล์ด้วย:

```js
// ที่เก็บข้อมูลปลอมของบอท (interface เดียวกับ store.mjs) เปิดให้เทสต์ดู/แก้ข้างในได้
export function createFakeStore({ links = {}, words = {}, budgets = {} } = {}) {
    let n = 0;
    const s = {
        links: { ...links },
        words: structuredClone(words),
        budgets: { ...budgets },
        drafts: new Map(),
        txs: new Map(),
        usage: new Map(),
        quotaCalls: 0,
        failNextApply: false,
        async findLink(lineUserId) {
            return s.links[lineUserId] || null;
        },
        async consumeQuota(uid, ctx) {
            s.quotaCalls += 1;
            const { decision, next } = decideQuota(s.usage.get(uid), ctx);
            if (next) s.usage.set(uid, next);
            return decision;
        },
        async getWords(uid) {
            return { ...(s.words[uid] || {}) };
        },
        async deleteExpiredDrafts(uid, now) {
            for (const [id, d] of s.drafts) if (d.userId === uid && d.expiresAt <= now) s.drafts.delete(id);
        },
        async createDraft(id, draft) {
            if (s.drafts.has(id)) return false;
            s.drafts.set(id, structuredClone(draft));
            return true;
        },
        async getDraft(id) {
            const d = s.drafts.get(id);
            return d ? structuredClone(d) : null;
        },
        newTxId() {
            n += 1;
            return `tx${n}`;
        },
        async applyDraft(id, expectedVersion, ops) {
            const current = s.drafts.get(id);
            if (s.failNextApply || !current || current.version !== expectedVersion) {
                s.failNextApply = false;
                return { ok: false, missing: [] };
            }
            const missing = [];
            s.drafts.set(id, { ...structuredClone(ops.draft), version: expectedVersion + 1 });
            for (const c of ops.creates) s.txs.set(c.id, { ...c.data, createdAt: "server" });
            for (const u of ops.updates) {
                if (s.txs.has(u.id)) s.txs.set(u.id, { ...s.txs.get(u.id), ...u.data });
                else missing.push(u.id);
            }
            for (const txId of ops.deletes) s.txs.delete(txId);
            if (ops.learn) s.words[ops.learn.uid] = { ...(s.words[ops.learn.uid] || {}), [ops.learn.word]: ops.learn.category };
            return { ok: true, missing };
        },
        async monthTotals(uid, start, end) {
            let income = 0;
            let expense = 0;
            for (const t of s.txs.values()) {
                if (t.userId !== uid || t.date < start || t.date >= end) continue;
                if (t.type === "income") income += t.amount;
                else expense += t.amount;
            }
            return { income, expense };
        },
        async getBudget(uid, key) {
            const b = s.budgets[uid];
            if (!b) return 0;
            const m = b.monthly?.[key];
            return m !== undefined && m !== null ? Number(m) : Number(b.budget) || 0;
        },
    };
    return s;
}
```

- [ ] **Step 2: เขียนเทสต์ที่ยังไม่ผ่าน**

`api/_lib/bot.test.mjs`
```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { handleEvent } from "./bot.mjs";
import { createFakeStore } from "./testing/fakes.mjs";

const NOW = new Date("2026-10-14T05:00:00Z"); // เที่ยงวันเวลาไทย
const LIMITS = { perMinute: 20, perDay: 300 };
const WEB = "https://app.test";
const ANN = { U1: { userId: "u1", displayName: "Ann" } };
const linkedStore = (extra = {}) => createFakeStore({ links: ANN, ...extra });
const text = (t, id = "m1", userId = "U1") => ({
    type: "message",
    replyToken: "rt",
    source: { userId },
    message: { type: "text", id, text: t },
});
const run = (store, event, { now = NOW, limits = LIMITS } = {}) => handleEvent(event, { store, now, limits, webUrl: WEB });
const str = (m) => JSON.stringify(m);

test("an unlinked LINE user gets the link card; nothing is counted or stored", async () => {
    const store = createFakeStore();
    const msgs = await run(store, text("ค่าข้าว 50"));
    assert.equal(msgs.length, 1);
    assert.match(str(msgs), /เข้าสู่ระบบ \/ เชื่อมบัญชี/);
    assert.match(str(msgs), /https:\/\/app\.test\//);
    assert.equal(store.quotaCalls, 0);
    assert.equal(store.drafts.size, 0);
});

test("follow greets linked and unlinked users differently", async () => {
    const follow = (userId) => ({ type: "follow", replyToken: "rt", source: { userId } });
    assert.match((await run(linkedStore(), follow("U1")))[0].text, /เริ่มจดได้เลย/);
    assert.match(str(await run(linkedStore(), follow("U9"))), /เชื่อมบัญชีที่หน้าเว็บ/);
});

test("stickers and events without a reply token are ignored without reading anything", async () => {
    const store = linkedStore();
    let reads = 0;
    const find = store.findLink;
    store.findLink = async (...args) => {
        reads += 1;
        return find(...args);
    };
    const sticker = { type: "message", replyToken: "rt", source: { userId: "U1" }, message: { type: "sticker", id: "s1" } };
    assert.deepEqual(await run(store, sticker), []);
    assert.deepEqual(await run(store, { ...text("ค่าข้าว 50"), replyToken: undefined }), []);
    assert.deepEqual(await run(store, { type: "unfollow", source: { userId: "U1" } }), []);
    assert.equal(reads, 0);
    assert.equal(store.quotaCalls, 0);
});

test("สรุป reports this month's totals and the month's budget", async () => {
    const store = linkedStore({ budgets: { u1: { budget: 10000, monthly: { "2026-10": 2000 } } } });
    store.txs.set("a", { userId: "u1", type: "expense", amount: 500, date: new Date("2026-10-02T05:00:00Z") });
    store.txs.set("b", { userId: "u1", type: "income", amount: 3000, date: new Date("2026-10-05T05:00:00Z") });
    store.txs.set("c", { userId: "u1", type: "expense", amount: 999, date: new Date("2026-09-30T05:00:00Z") });
    store.txs.set("d", { userId: "u2", type: "expense", amount: 777, date: new Date("2026-10-03T05:00:00Z") });
    const out = str(await run(store, text("สรุป")));
    assert.match(out, /สรุป ต\.ค\. 2569/);
    assert.match(out, /รายรับ 3,000 บาท/);
    assert.match(out, /รายจ่าย 500 บาท/);
    assert.match(out, /คงเหลือ 2,500 บาท/);
    assert.match(out, /ใช้ไป 25% ของงบ เหลือ 1,500 บาท/);
    assert.match(str(await run(store, text("เดือนนี้", "m2"))), /สรุป ต\.ค\. 2569/);
});

test("help words and messages without an amount reply with examples and store nothing", async () => {
    const store = linkedStore();
    assert.match((await run(store, text("วิธีใช้")))[0].text, /ค่าข้าว 50/);
    assert.match((await run(store, text("HELP")))[0].text, /ค่าข้าว 50/);
    assert.match((await run(store, text("สวัสดี")))[0].text, /^ไม่พบจำนวนเงินในข้อความ/);
    assert.equal(store.drafts.size, 0);
});

test("a parse error is explained and nothing is stored", async () => {
    const store = linkedStore();
    assert.deepEqual((await run(store, text("15/10/2026 ค่าข้าว 50"))).map((m) => m.text), ["บันทึกล่วงหน้าไม่ได้ ใส่วันที่ไม่เกินวันนี้"]);
    assert.equal(store.drafts.size, 0);
});

test("the spec example asks for a date and saves nothing yet", async () => {
    const store = linkedStore();
    const msgs = await run(store, text("ค่าข้าวตอนกลางวัน 50 บาท ค่าน้ำ 100 บาท ค่าเน็ต 20 บาท", "m9"));
    assert.match(str(msgs), /เป็นของวันไหน/);
    assert.match(str(msgs), /"type":"datetimepicker"/);
    const draft = store.drafts.get("m9");
    assert.equal(draft.status, "awaitingDate");
    assert.equal(draft.version, 0);
    assert.deepEqual(draft.items.map((it) => it.category), ["food", "bills", "bills"]);
    assert.ok(draft.expiresAt.getTime() - NOW.getTime() === 7 * 24 * 60 * 60 * 1000);
    assert.equal(store.txs.size, 0);
});

test("a typed date saves known items at noon Bangkok time right away", async () => {
    const store = linkedStore();
    const msgs = await run(store, text("เมื่อวาน ค่าข้าว 50"));
    assert.equal(store.txs.size, 1);
    const tx = [...store.txs.values()][0];
    assert.deepEqual(
        { ...tx, date: tx.date.toISOString() },
        { userId: "u1", amount: 50, type: "expense", category: "food", note: "ค่าข้าว", date: "2026-10-13T05:00:00.000Z", createdAt: "server" }
    );
    assert.match(str(msgs), /บันทึกแล้ว 1 รายการ · เมื่อวาน/);
    assert.equal(store.drafts.get("m1").status, "open");
});

test("unknown words: known items are saved, then a category question follows", async () => {
    const store = linkedStore();
    const msgs = await run(store, text("เมื่อวาน ค่าแมว 300 ค่าข้าว 50"));
    assert.equal(store.txs.size, 1);
    assert.equal(msgs.length, 2);
    assert.equal(msgs[1].text, "เลือกหมวดของ “ค่าแมว 300 บาท”");
    assert.equal(msgs[1].quickReply.items.length, 11);
});

test("personal words categorize without asking", async () => {
    const store = linkedStore({ words: { u1: { "ค่าแมว": "other" } } });
    await run(store, text("เมื่อวาน ค่าแมว 300"));
    assert.equal([...store.txs.values()][0].category, "other");
});

test("a redelivered message is not processed twice", async () => {
    const store = linkedStore();
    await run(store, text("เมื่อวาน ค่าข้าว 50", "dup"));
    assert.deepEqual(await run(store, text("เมื่อวาน ค่าข้าว 50", "dup")), []);
    assert.equal(store.txs.size, 1);
});

test("expired drafts are removed when a new message arrives", async () => {
    const store = linkedStore();
    store.drafts.set("old", { userId: "u1", status: "awaitingDate", items: [], expiresAt: new Date("2026-10-01T00:00:00Z"), version: 0 });
    store.drafts.set("other-user", { userId: "u2", status: "awaitingDate", items: [], expiresAt: new Date("2026-10-01T00:00:00Z"), version: 0 });
    await run(store, text("ค่าข้าว 50", "m2"));
    assert.equal(store.drafts.has("old"), false);
    assert.equal(store.drafts.has("other-user"), true);
    assert.equal(store.drafts.has("m2"), true);
});

test("the per-minute limit warns once, then stays silent, and resets the next minute", async () => {
    const store = linkedStore();
    const limits = { perMinute: 2, perDay: 300 };
    await run(store, text("ค่าข้าว 50", "a"), { limits });
    await run(store, text("ค่าข้าว 50", "b"), { limits });
    assert.deepEqual((await run(store, text("ค่าข้าว 50", "c"), { limits })).map((m) => m.text), ["ส่งเร็วเกินไป รอสักครู่แล้วลองใหม่"]);
    assert.deepEqual(await run(store, text("ค่าข้าว 50", "d"), { limits }), []);
    assert.equal(store.drafts.has("c") || store.drafts.has("d"), false);
    const later = new Date(NOW.getTime() + 60_000);
    assert.match(str(await run(store, text("ค่าข้าว 50", "e"), { limits, now: later })), /เป็นของวันไหน/);
});

test("a per-user daily limit of 0 suspends the bot after one warning", async () => {
    const store = linkedStore();
    store.usage.set("u1", { limitPerDay: 0 });
    assert.match(str(await run(store, text("ค่าข้าว 50", "a"))), /วันนี้ใช้ครบแล้ว/);
    assert.deepEqual(await run(store, text("ค่าข้าว 50", "b")), []);
});
```

- [ ] **Step 3: รันเทสต์ให้เห็นว่ายังไม่ผ่าน**

Run: `node --test api/_lib/bot.test.mjs`
Expected: FAIL เพราะ `Cannot find module '.../bot.mjs'`

- [ ] **Step 4: เขียน `api/_lib/bot.mjs`** (มีฟังก์ชัน `onPostback` ครบทุก action ในไฟล์นี้เลย ส่วนเทสต์ postback อยู่ใน Task 13)

```js
import { learnKey, parseMessage } from "./parse.mjs";
import { decodePostback } from "./postback.mjs";
import { isCategory, typeOf } from "./categories.mjs";
import { addDays, bangkokYmd, minuteIndex, monthBounds, monthKey, noonBangkok } from "./thaiDate.mjs";
import {
    MSG, categoryQuickReply, dateCard, errorText, fixItemsQuickReply, helpMessage, limitMessage,
    monthSummaryMessage, notLinkedMessage, statusText, summaryCard, textMessage, welcomeMessage,
} from "./messages.mjs";

export const DRAFT_TTL_MS = 7 * 24 * 60 * 60 * 1000;
export const MAX_WORDS = 500;
const SUMMARY_WORDS = new Set(["สรุป", "เดือนนี้", "สรุปเดือนนี้"]);
const HELP_WORDS = new Set(["วิธีใช้", "help"]);
const YMD = /^\d{4}-\d{2}-\d{2}$/;

// event หนึ่งตัวจาก webhook -> ข้อความที่จะตอบ ([] = ไม่ตอบ)
// deps = { store, now, limits, webUrl } (store ดู interface ใน testing/fakes.mjs และ store.mjs)
export async function handleEvent(event, deps) {
    const { store, now, limits, webUrl } = deps;
    const lineUserId = event?.source?.userId;
    if (!lineUserId || !event.replyToken) return [];
    const isText = event.type === "message" && event.message?.type === "text";
    if (!isText && event.type !== "postback" && event.type !== "follow") return [];

    const link = await store.findLink(lineUserId);
    if (event.type === "follow") return [welcomeMessage(Boolean(link), webUrl)];
    if (!link) return [notLinkedMessage(webUrl)];

    const ctx = { ...deps, uid: link.userId, today: bangkokYmd(now) };
    const pb = event.type === "postback" ? decodePostback(event.postback?.data) : null;
    // เลิกทำ/ยกเลิก ต้องทำได้เสมอ (ทำได้ครั้งเดียวต่อรายการอยู่แล้ว)
    const exempt = pb?.a === "undo" || pb?.a === "cancel";
    if (!exempt) {
        const decision = await store.consumeQuota(ctx.uid, { today: ctx.today, minute: minuteIndex(now), limits });
        if (decision === "silent") return [];
        if (decision !== "ok") return [limitMessage(decision, webUrl)];
    }
    return isText ? onText(event, ctx) : onPostback(event, pb, ctx);
}

// ---------- ข้อความ ----------

async function onText(event, ctx) {
    const { store, uid, today, now } = ctx;
    const text = event.message.text.trim();
    if (SUMMARY_WORDS.has(text)) return [await monthSummary(ctx)];
    if (HELP_WORDS.has(text.toLowerCase())) return [helpMessage()];

    const parsed = parseMessage(text, { personal: await store.getWords(uid), today });
    if (parsed.error) return [textMessage(errorText(parsed.error))];
    if (parsed.items.length === 0) return [helpMessage(MSG.noAmount)];

    await store.deleteExpiredDrafts(uid, now);
    const id = event.message.id; // LINE ส่ง event ซ้ำ -> id เดิม -> createDraft คืน false
    const draft = {
        userId: uid,
        date: null,
        status: "awaitingDate",
        ignored: parsed.ignored,
        items: parsed.items.map((it) => ({ ...it, state: "pending", txId: null })),
        createdAt: now,
        expiresAt: new Date(now.getTime() + DRAFT_TTL_MS),
        version: 0,
    };
    if (!(await store.createDraft(id, draft))) return [];
    if (!parsed.date) return [dateCard(id, draft, today)];
    return commitDate(id, draft, parsed.date, ctx);
}

async function monthSummary({ store, uid, today, webUrl }) {
    const { start, end } = monthBounds(today);
    const [totals, budget] = await Promise.all([store.monthTotals(uid, start, end), store.getBudget(uid, monthKey(today))]);
    return monthSummaryMessage({ today, ...totals, budget, webUrl });
}

// ---------- บันทึก ----------

const txData = (uid, item, date) => ({
    userId: uid,
    amount: item.amount,
    type: item.type,
    category: item.category,
    note: item.note,
    date: noonBangkok(date),
});

function learnOp(uid, note, category, words) {
    const word = learnKey(note);
    if (!word) return null;
    if (!(word in words) && Object.keys(words).length >= MAX_WORDS) return null;
    return { uid, word, category };
}

async function apply(ctx, id, draft, next, ops, reply) {
    const res = await ctx.store.applyDraft(id, draft.version, {
        draft: next,
        creates: [],
        updates: [],
        deletes: [],
        learn: null,
        ...ops,
    });
    if (!res.ok) return [textMessage(MSG.conflict)];
    return reply(res);
}

const firstPending = (draft) => draft.items.findIndex((it) => it.state === "pending");

const question = (id, draft, k, lead) =>
    categoryQuickReply({ draftId: id, index: k, item: draft.items[k], kind: draft.items[k].type, mode: "pick", lead });

// หลังเลือกวัน: การ์ดสรุป + (ถ้ามี) คำถามหมวดของรายการแรกที่ยังไม่รู้หมวด
function afterSave(id, draft, today) {
    const k = firstPending(draft);
    const card = summaryCard(id, draft, today);
    return k === -1 ? [card] : [card, question(id, draft, k)];
}

// หลังเลือกหมวด/ข้าม: ถามรายการถัดไป หรือจบด้วยการ์ดสรุป
function nextQuestion(id, draft, today, lead) {
    const k = firstPending(draft);
    return k === -1 ? [summaryCard(id, draft, today)] : [question(id, draft, k, lead)];
}

function commitDate(id, draft, date, ctx) {
    const { store, uid, today } = ctx;
    const next = structuredClone(draft);
    next.date = date;
    next.status = "open";
    const creates = [];
    for (const it of next.items) {
        if (it.state !== "pending" || !it.category) continue;
        it.txId = store.newTxId();
        it.state = "saved";
        creates.push({ id: it.txId, data: txData(uid, it, date) });
    }
    return apply(ctx, id, draft, next, { creates }, () => afterSave(id, next, today));
}

// ---------- ปุ่ม ----------

async function onPostback(event, pb, ctx) {
    const { store, uid, today, now } = ctx;
    const id = pb.d;
    const draft = id ? await store.getDraft(id) : null;
    if (!draft || draft.userId !== uid) return [textMessage(MSG.notFound)];
    if (draft.expiresAt <= now) return [textMessage(MSG.expired)];
    const i = pb.i === undefined ? null : Number(pb.i);
    const item = i === null ? null : draft.items[i];

    if (pb.a === "date") {
        if (draft.status !== "awaitingDate") return [textMessage(statusText(draft.status))];
        const date = pb.v === "today" ? today : pb.v === "yesterday" ? addDays(today, -1) : event.postback?.params?.date;
        // max ของ datetimepicker บังคับได้แค่ในแอป LINE -> ตรวจซ้ำที่นี่
        if (!YMD.test(date || "") || date > today) return [textMessage(MSG.badDate)];
        return commitDate(id, draft, date, ctx);
    }
    if (pb.a === "cancel") {
        if (draft.status !== "awaitingDate") return [textMessage(statusText(draft.status))];
        return apply(ctx, id, draft, { ...draft, status: "cancelled" }, {}, () => [textMessage(MSG.cancelled)]);
    }
    if (pb.a === "undo") {
        if (draft.status !== "open") return [textMessage(statusText(draft.status))];
        const saved = draft.items.filter((it) => it.state === "saved");
        return apply(ctx, id, draft, { ...draft, status: "undone" }, { deletes: saved.map((it) => it.txId) }, () => [
            textMessage(MSG.undone(saved.length)),
        ]);
    }

    if (draft.status !== "open") return [textMessage(statusText(draft.status))];

    switch (pb.a) {
        case "ask":
            if (item?.state !== "pending") return [textMessage(MSG.alreadyDone)];
            return [question(id, draft, i)];

        case "types": {
            const mode = pb.m === "fix" ? "fix" : "pick";
            if (item?.state !== (mode === "fix" ? "saved" : "pending")) return [textMessage(MSG.alreadyDone)];
            const kind = pb.k === "income" ? "income" : "expense";
            return [categoryQuickReply({ draftId: id, index: i, item, kind, mode })];
        }

        case "cat": {
            if (item?.state !== "pending") return [textMessage(MSG.alreadyDone)];
            if (!isCategory(pb.c)) return [textMessage(MSG.badCategory)];
            const next = structuredClone(draft);
            const it = next.items[i];
            Object.assign(it, { category: pb.c, type: typeOf(pb.c), state: "saved", txId: store.newTxId() });
            const learn = learnOp(uid, it.note, pb.c, await store.getWords(uid));
            return apply(ctx, id, draft, next, { creates: [{ id: it.txId, data: txData(uid, it, next.date) }], learn }, () =>
                nextQuestion(id, next, today, MSG.savedOne(it.note))
            );
        }

        case "skip": {
            if (item?.state !== "pending") return [textMessage(MSG.alreadyDone)];
            const next = structuredClone(draft);
            next.items[i].state = "skipped";
            return apply(ctx, id, draft, next, {}, () => nextQuestion(id, next, today));
        }

        case "fix":
            if (i === null) {
                return draft.items.some((it) => it.state === "saved")
                    ? [fixItemsQuickReply(id, draft)]
                    : [textMessage(MSG.nothingSaved)];
            }
            if (item?.state !== "saved") return [textMessage(MSG.alreadyDone)];
            return [categoryQuickReply({ draftId: id, index: i, item, kind: item.type, mode: "fix" })];

        case "fixcat": {
            if (item?.state !== "saved") return [textMessage(MSG.alreadyDone)];
            if (!isCategory(pb.c)) return [textMessage(MSG.badCategory)];
            const next = structuredClone(draft);
            const it = next.items[i];
            Object.assign(it, { category: pb.c, type: typeOf(pb.c) });
            const learn = learnOp(uid, it.note, pb.c, await store.getWords(uid));
            const updates = [{ id: it.txId, data: { category: it.category, type: it.type } }];
            return apply(ctx, id, draft, next, { updates, learn }, (res) =>
                res.missing.length ? [textMessage(MSG.txGone)] : [summaryCard(id, next, today)]
            );
        }

        default:
            return [];
    }
}
```

- [ ] **Step 5: รันเทสต์ให้ผ่าน**

Run: `npm run test:server`
Expected: PASS ทุกเทสต์

- [ ] **Step 6: Commit**

```bash
git add api/_lib/bot.mjs api/_lib/bot.test.mjs api/_lib/testing/fakes.mjs
git commit -m "Add LINE bot event handling for messages, summary and limits" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 13: บอทฝั่งปุ่ม (เทสต์ postback ทุก action)

**Files:**
- Test: `api/_lib/bot.postback.test.mjs`
- Modify: `api/_lib/bot.mjs` เฉพาะกรณีที่เทสต์เจอบั๊ก

**Interfaces:**
- Consumes: `handleEvent`, `createFakeStore` (Task 12) และ `encodePostback` (Task 10)

- [ ] **Step 1: เขียนเทสต์**

`api/_lib/bot.postback.test.mjs`
```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { handleEvent } from "./bot.mjs";
import { encodePostback } from "./postback.mjs";
import { createFakeStore } from "./testing/fakes.mjs";

const NOW = new Date("2026-10-14T05:00:00Z");
const LIMITS = { perMinute: 20, perDay: 300 };
const LINKS = { U1: { userId: "u1", displayName: "Ann" }, U2: { userId: "u2", displayName: "Bob" } };
const store0 = (extra = {}) => createFakeStore({ links: LINKS, ...extra });
const text = (t, id = "m1") => ({ type: "message", replyToken: "rt", source: { userId: "U1" }, message: { type: "text", id, text: t } });
const tap = (data, params, userId = "U1") => ({
    type: "postback",
    replyToken: "rt",
    source: { userId },
    postback: { data: encodePostback(data), ...(params ? { params } : {}) },
});
const run = (store, event, now = NOW) => handleEvent(event, { store, now, limits: LIMITS, webUrl: "https://app.test" });
const texts = (msgs) => msgs.map((m) => m.text);
const str = (m) => JSON.stringify(m);

async function awaiting(store, message = "ค่าข้าว 50 ค่าแมว 300", id = "m1") {
    await run(store, text(message, id));
    return id;
}
async function opened(store, message, id) {
    const d = await awaiting(store, message, id);
    await run(store, tap({ a: "date", d, v: "today" }));
    return d;
}

test("today saves known items at noon and asks about the unknown one", async () => {
    const store = store0();
    const d = await awaiting(store);
    const msgs = await run(store, tap({ a: "date", d, v: "today" }));
    assert.equal(store.txs.size, 1);
    assert.equal([...store.txs.values()][0].date.toISOString(), "2026-10-14T05:00:00.000Z");
    assert.match(str(msgs[0]), /บันทึกแล้ว 1 รายการ · วันนี้ \(14 ต\.ค\.\)/);
    assert.equal(msgs[1].text, "เลือกหมวดของ “ค่าแมว 300 บาท”");
    assert.equal(store.drafts.get(d).status, "open");
});

test("yesterday and the date picker set the date", async () => {
    const a = store0();
    await run(a, tap({ a: "date", d: await awaiting(a, "ค่าข้าว 50"), v: "yesterday" }));
    assert.equal([...a.txs.values()][0].date.toISOString(), "2026-10-13T05:00:00.000Z");
    const b = store0();
    await run(b, tap({ a: "date", d: await awaiting(b, "ค่าข้าว 50"), v: "pick" }, { date: "2026-10-01" }));
    assert.equal([...b.txs.values()][0].date.toISOString(), "2026-10-01T05:00:00.000Z");
});

test("a future or malformed picked date is refused without saving", async () => {
    for (const params of [{ date: "2026-10-15" }, { date: "14/10/2026" }, undefined]) {
        const store = store0();
        const d = await awaiting(store, "ค่าข้าว 50");
        assert.deepEqual(texts(await run(store, tap({ a: "date", d, v: "pick" }, params))), ["เลือกวันที่ไม่เกินวันนี้"]);
        assert.equal(store.txs.size, 0);
        assert.equal(store.drafts.get(d).status, "awaitingDate");
    }
});

test("tapping a date twice saves once", async () => {
    const store = store0();
    const d = await awaiting(store, "ค่าข้าว 50");
    await run(store, tap({ a: "date", d, v: "today" }));
    assert.deepEqual(texts(await run(store, tap({ a: "date", d, v: "yesterday" }))), ["บันทึกไปแล้ว"]);
    assert.equal(store.txs.size, 1);
});

test("cancel discards the draft and later taps say so", async () => {
    const store = store0();
    const d = await awaiting(store, "ค่าข้าว 50");
    assert.deepEqual(texts(await run(store, tap({ a: "cancel", d }))), ["ยกเลิกแล้ว ไม่ได้บันทึกรายการ"]);
    assert.deepEqual(texts(await run(store, tap({ a: "date", d, v: "today" }))), ["ยกเลิกไปแล้ว"]);
    assert.equal(store.txs.size, 0);
});

test("picking a category saves the item, learns the word and ends with the summary", async () => {
    const store = store0();
    const d = await opened(store);
    const msgs = await run(store, tap({ a: "cat", d, i: 1, c: "other" }));
    assert.equal(store.txs.size, 2);
    const cat = [...store.txs.values()].find((t) => t.note === "ค่าแมว");
    assert.deepEqual([cat.category, cat.type, cat.amount], ["other", "expense", 300]);
    assert.equal(store.words.u1["ค่าแมว"], "other");
    assert.match(str(msgs), /บันทึกแล้ว 2 รายการ/);
});

test("with two unknown items the next question carries a saved line", async () => {
    const store = store0();
    const d = await opened(store, "ค่าแมว 300 ค่าหมา 200");
    const msgs = await run(store, tap({ a: "cat", d, i: 0, c: "other" }));
    assert.equal(msgs[0].text, "✓ บันทึก “ค่าแมว” แล้ว\nเลือกหมวดของ “ค่าหมา 200 บาท”");
});

test("an unknown category key or another user's draft writes nothing", async () => {
    const store = store0();
    const d = await opened(store);
    assert.deepEqual(texts(await run(store, tap({ a: "cat", d, i: 1, c: "hacker" }))), ["ไม่พบหมวดนี้ ลองเลือกใหม่อีกครั้ง"]);
    assert.deepEqual(texts(await run(store, tap({ a: "cat", d, i: 1, c: "other" }, undefined, "U2"))), ["ไม่พบรายการนี้"]);
    assert.deepEqual(texts(await run(store, tap({ a: "undo", d }, undefined, "U2"))), ["ไม่พบรายการนี้"]);
    assert.deepEqual(texts(await run(store, tap({ a: "cat", d: "nope", i: 0, c: "food" }))), ["ไม่พบรายการนี้"]);
    assert.equal(store.txs.size, 1);
    assert.equal(store.words.u1, undefined);
});

test("skip leaves the item unsaved and moves on", async () => {
    const store = store0();
    const d = await opened(store);
    const msgs = await run(store, tap({ a: "skip", d, i: 1 }));
    assert.equal(store.txs.size, 1);
    assert.equal(store.drafts.get(d).items[1].state, "skipped");
    assert.match(str(msgs), /ไม่บันทึก: ค่าแมว 300/);
});

test("types switches the quick reply between expense and income lists", async () => {
    const store = store0();
    const d = await opened(store);
    const [msg] = await run(store, tap({ a: "types", d, i: 1, k: "income", m: "pick" }));
    const labels = msg.quickReply.items.map((x) => x.action.label);
    assert.deepEqual(labels, ["เงินเดือน", "โบนัส", "งานเสริม", "รายรับอื่นๆ", "รายจ่าย…", "ไม่บันทึก"]);
    await run(store, tap({ a: "cat", d, i: 1, c: "freelance" }));
    assert.equal([...store.txs.values()].find((t) => t.note === "ค่าแมว").type, "income");
});

test("fix lists saved items, then fixcat updates the transaction and learns", async () => {
    const store = store0();
    const d = await opened(store, "ค่าน้ำ 15");
    const [list] = await run(store, tap({ a: "fix", d }));
    assert.equal(list.quickReply.items.length, 1);
    const [cats] = await run(store, tap({ a: "fix", d, i: 0 }));
    assert.equal(cats.quickReply.items.length, 10);
    const msgs = await run(store, tap({ a: "fixcat", d, i: 0, c: "food" }));
    assert.equal([...store.txs.values()][0].category, "food");
    assert.equal(store.words.u1["ค่าน้ำ"], "food");
    assert.match(str(msgs), /อาหาร\/เครื่องดื่ม/);
});

test("fixcat on a transaction deleted on the web still learns and says so", async () => {
    const store = store0();
    const d = await opened(store, "ค่าน้ำ 15");
    store.txs.clear();
    assert.deepEqual(texts(await run(store, tap({ a: "fixcat", d, i: 0, c: "food" }))), [
        "รายการนี้ถูกลบไปแล้ว แต่ระบบจำหมวดของคำนี้ไว้ให้แล้ว",
    ]);
    assert.equal(store.words.u1["ค่าน้ำ"], "food");
    assert.equal(store.txs.size, 0);
});

test("fix with nothing saved says so", async () => {
    const store = store0();
    const d = await opened(store, "ค่าแมว 300");
    assert.deepEqual(texts(await run(store, tap({ a: "fix", d }))), ["ยังไม่มีรายการที่บันทึก"]);
});

test("undo removes everything saved from the message, even when over the limit", async () => {
    const store = store0();
    const d = await opened(store, "ค่าข้าว 50 ค่าน้ำ 100");
    store.usage.set("u1", { ...store.usage.get("u1"), limitPerDay: 0, warnedDay: true });
    assert.deepEqual(texts(await run(store, tap({ a: "undo", d }))), ["เลิกทำแล้ว ลบ 2 รายการ"]);
    assert.equal(store.txs.size, 0);
    assert.deepEqual(texts(await run(store, tap({ a: "undo", d }))), ["เลิกทำไปแล้ว"]);
});

test("buttons on drafts older than 7 days report expiry", async () => {
    const store = store0();
    const d = await awaiting(store, "ค่าข้าว 50");
    const later = new Date(NOW.getTime() + 8 * 24 * 60 * 60 * 1000);
    assert.deepEqual(texts(await run(store, tap({ a: "date", d, v: "today" }), later)), ["รายการนี้หมดอายุแล้ว พิมพ์ใหม่อีกครั้ง"]);
    assert.equal(store.txs.size, 0);
});

test("asking about an already saved item, or before choosing a date, is answered plainly", async () => {
    const store = store0();
    const d = await awaiting(store);
    assert.deepEqual(texts(await run(store, tap({ a: "ask", d, i: 1 }))), ["รายการนี้ยังไม่ได้เลือกวัน"]);
    await run(store, tap({ a: "date", d, v: "today" }));
    assert.deepEqual(texts(await run(store, tap({ a: "ask", d, i: 0 }))), ["รายการนี้จัดการไปแล้ว"]);
    assert.equal((await run(store, tap({ a: "ask", d, i: 1 })))[0].quickReply.items.length, 11);
});

test("a concurrent write conflict asks the user to retry and writes nothing", async () => {
    const store = store0();
    const d = await awaiting(store, "ค่าข้าว 50");
    store.failNextApply = true;
    assert.deepEqual(texts(await run(store, tap({ a: "date", d, v: "today" }))), ["มีการกดซ้อนกัน ลองใหม่อีกครั้ง"]);
    assert.equal(store.txs.size, 0);
});

test("the personal dictionary stops growing at 500 words but existing words still update", async () => {
    const full = Object.fromEntries(Array.from({ length: 499 }, (_, i) => [`คำ${i}`, "other"]));
    const store = store0({ words: { u1: { ...full, "ค่าน้ำ": "bills" } } });
    const d = await opened(store, "ค่าแมว 300 ค่าน้ำ 15");
    await run(store, tap({ a: "cat", d, i: 0, c: "other" }));
    assert.equal(store.words.u1["ค่าแมว"], undefined);
    await run(store, tap({ a: "fixcat", d, i: 1, c: "food" }));
    assert.equal(store.words.u1["ค่าน้ำ"], "food");
    assert.equal(Object.keys(store.words.u1).length, 500);
});
```

- [ ] **Step 2: รันเทสต์**

Run: `node --test api/_lib/bot.postback.test.mjs`
Expected: PASS เพราะ `onPostback` เขียนไว้แล้วใน Task 12 ถ้ามีเทสต์ไหนไม่ผ่าน แสดงว่าโค้ดไม่ตรงกับ spec ข้อ 6 ให้แก้ `bot.mjs` (ห้ามแก้เทสต์ให้ตรงกับผลที่ผิด) แล้วรันใหม่จนผ่าน

- [ ] **Step 3: รันเทสต์ฝั่ง server ทั้งหมด**

Run: `npm run test:server`
Expected: PASS ทุกเทสต์

- [ ] **Step 4: Commit**

```bash
git add api/_lib/bot.postback.test.mjs api/_lib/bot.mjs
git commit -m "Cover every LINE bot button action with tests" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 14: Firestore store, LINE API และ webhook

**Files:**
- Create: `api/_lib/store.mjs`, `api/_lib/lineApi.mjs`, `api/_lib/webhookRoute.mjs`, `api/line/webhook.mjs`
- Test: `api/_lib/lineApi.test.mjs`, `api/_lib/webhookRoute.test.mjs`

**Interfaces:**
- Consumes: Store interface (Task 12), `handleEvent` (Task 12), `MSG`, `textMessage` (Task 11), `decideQuota` (Task 10), `fakeFetch`, `createFakeStore` (fakes)
- Produces:
  - `createFirestoreStore(db) → store`
  - `verifySignature(rawBody: Buffer, signature, secret) → boolean`
  - `replyMessage(replyToken, messages, accessToken, fetchImpl = fetch) → Promise<void>`
  - `createWebhookHandler({ channelSecret, accessToken, store, limits, fetchImpl = fetch, clock = () => new Date() }) → (Request) => Promise<Response>`

- [ ] **Step 1: เขียนเทสต์ที่ยังไม่ผ่าน**

`api/_lib/lineApi.test.mjs`
```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { replyMessage, verifySignature } from "./lineApi.mjs";
import { fakeFetch } from "./testing/fakes.mjs";

const REPLY = "https://api.line.me/v2/bot/message/reply";
const sign = (body, secret) => createHmac("sha256", secret).update(body).digest("base64");

test("verifySignature accepts LINE's HMAC and rejects anything else", () => {
    const body = Buffer.from('{"events":[{"message":{"text":"ค่าข้าว 50"}}]}');
    assert.equal(verifySignature(body, sign(body, "sec"), "sec"), true);
    assert.equal(verifySignature(body, sign(body, "other"), "sec"), false);
    assert.equal(verifySignature(Buffer.from("{}"), sign(body, "sec"), "sec"), false);
    assert.equal(verifySignature(body, null, "sec"), false);
    assert.equal(verifySignature(body, "short", "sec"), false);
});

test("replyMessage posts JSON with the bearer token and skips empty replies", async () => {
    const f = fakeFetch({ [REPLY]: { body: {} } });
    await replyMessage("rt", [], "tok", f);
    assert.equal(f.calls.length, 0);
    await replyMessage("rt", [{ type: "text", text: "hi" }], "tok", f);
    assert.equal(f.calls[0].init.method, "POST");
    assert.equal(f.calls[0].init.headers.Authorization, "Bearer tok");
    assert.equal(f.calls[0].init.headers["Content-Type"], "application/json");
    assert.deepEqual(JSON.parse(f.calls[0].body), { replyToken: "rt", messages: [{ type: "text", text: "hi" }] });
});

test("replyMessage throws when LINE rejects the reply", async () => {
    const f = fakeFetch({ [REPLY]: { status: 400, body: { message: "Invalid reply token" } } });
    await assert.rejects(replyMessage("rt", [{ type: "text", text: "hi" }], "tok", f), /400/);
});
```

`api/_lib/webhookRoute.test.mjs`
```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { createWebhookHandler } from "./webhookRoute.mjs";
import { createFakeStore, fakeFetch } from "./testing/fakes.mjs";

const SECRET = "sec";
const REPLY = "https://api.line.me/v2/bot/message/reply";
const NOW = new Date("2026-10-14T05:00:00Z");
const sign = (body) => createHmac("sha256", SECRET).update(body).digest("base64");
const request = (body, signature = sign(body)) =>
    new Request("https://app.test/api/line/webhook", { method: "POST", headers: { "x-line-signature": signature }, body });
const handler = (store, fetchImpl) =>
    createWebhookHandler({ channelSecret: SECRET, accessToken: "tok", store, limits: { perMinute: 20, perDay: 300 }, fetchImpl, clock: () => NOW });
const textEvent = (userId, text, replyToken = "r1") => ({
    type: "message",
    replyToken,
    source: { userId },
    message: { type: "text", id: `id-${replyToken}`, text },
});

test("an invalid signature is rejected with 401 and nothing is processed", async () => {
    const store = createFakeStore();
    const f = fakeFetch({ [REPLY]: { body: {} } });
    const body = JSON.stringify({ events: [textEvent("U1", "ค่าข้าว 50")] });
    const res = await handler(store, f)(request(body, sign("something else")));
    assert.equal(res.status, 401);
    assert.equal(f.calls.length, 0);
});

test("LINE's webhook verification (no events) gets 200 without a reply", async () => {
    const f = fakeFetch({ [REPLY]: { body: {} } });
    const res = await handler(createFakeStore(), f)(request(JSON.stringify({ destination: "x", events: [] })));
    assert.equal(res.status, 200);
    assert.equal(f.calls.length, 0);
});

test("each event is answered through the reply API with its own token, using the request origin for links", async () => {
    const f = fakeFetch({ [REPLY]: { body: {} } });
    const body = JSON.stringify({ events: [textEvent("U9", "ค่าข้าว 50", "r1"), textEvent("U9", "สวัสดี", "r2")] });
    const res = await handler(createFakeStore(), f)(request(body));
    assert.equal(res.status, 200);
    assert.deepEqual(f.calls.map((c) => JSON.parse(c.body).replyToken), ["r1", "r2"]);
    assert.match(f.calls[0].body, /https:\/\/app\.test\//);
});

test("Thai text survives the raw-body signature check", async () => {
    const store = createFakeStore({ links: { U1: { userId: "u1" } } });
    const f = fakeFetch({ [REPLY]: { body: {} } });
    await handler(store, f)(request(JSON.stringify({ events: [textEvent("U1", "ค่าข้าวตอนกลางวัน 50 บาท")] })));
    assert.equal(store.drafts.get("id-r1").items[0].note, "ค่าข้าวตอนกลางวัน");
});

test("when an event fails the user gets the system error and LINE still gets 200", async () => {
    const store = createFakeStore();
    store.findLink = async () => {
        throw new Error("db down");
    };
    const f = fakeFetch({ [REPLY]: { body: {} } });
    const res = await handler(store, f)(request(JSON.stringify({ events: [textEvent("U1", "ค่าข้าว 50")] })));
    assert.equal(res.status, 200);
    assert.match(f.calls[0].body, /ระบบขัดข้อง/);
});

test("a body that is not JSON gets 400", async () => {
    const res = await handler(createFakeStore(), fakeFetch({}))(request("not json"));
    assert.equal(res.status, 400);
});
```

- [ ] **Step 2: รันเทสต์ให้เห็นว่ายังไม่ผ่าน**

Run: `node --test api/_lib/lineApi.test.mjs api/_lib/webhookRoute.test.mjs`
Expected: FAIL เพราะ `Cannot find module`

- [ ] **Step 3: เขียนโค้ด**

`api/_lib/lineApi.mjs`
```js
import { createHmac, timingSafeEqual } from "node:crypto";

// ตรวจว่า request มาจาก LINE จริง: x-line-signature = base64(HMAC-SHA256(channel secret, raw body))
export function verifySignature(rawBody, signature, secret) {
    if (!signature || !secret) return false;
    const expected = createHmac("sha256", secret).update(rawBody).digest();
    const given = Buffer.from(signature, "base64");
    return given.length === expected.length && timingSafeEqual(given, expected);
}

// reply message ไม่นับโควตาข้อความของ LINE (push นับ) -> ใช้แค่ reply
export async function replyMessage(replyToken, messages, accessToken, fetchImpl = fetch) {
    if (!messages.length) return;
    const res = await fetchImpl("https://api.line.me/v2/bot/message/reply", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ replyToken, messages }),
    });
    if (!res.ok) throw new Error(`LINE reply failed (${res.status}): ${await res.text()}`);
}
```

`api/_lib/webhookRoute.mjs`
```js
import { replyMessage, verifySignature } from "./lineApi.mjs";
import { handleEvent } from "./bot.mjs";
import { MSG, textMessage } from "./messages.mjs";

// POST /api/line/webhook
export function createWebhookHandler({ channelSecret, accessToken, store, limits, fetchImpl = fetch, clock = () => new Date() }) {
    return async (request) => {
        // ต้องตรวจลายเซ็นกับ byte ดิบ ก่อนแปลงเป็น JSON
        const raw = Buffer.from(await request.arrayBuffer());
        if (!verifySignature(raw, request.headers.get("x-line-signature"), channelSecret)) {
            return new Response("invalid signature", { status: 401 });
        }
        let body;
        try {
            body = JSON.parse(raw.toString("utf8"));
        } catch {
            return new Response("bad request", { status: 400 });
        }

        const webUrl = new URL(request.url).origin;
        for (const event of body.events || []) {
            try {
                const messages = await handleEvent(event, { store, now: clock(), limits, webUrl });
                await replyMessage(event.replyToken, messages, accessToken, fetchImpl);
            } catch (err) {
                // ไม่ใส่ข้อความของผู้ใช้หรือ token ลง log
                console.error("LINE event failed:", err?.message);
                if (event.replyToken) {
                    await replyMessage(event.replyToken, [textMessage(MSG.systemError)], accessToken, fetchImpl).catch(() => {});
                }
            }
        }
        // ตอบ 200 เสมอเมื่อลายเซ็นถูก ไม่งั้น LINE จะถือว่า webhook พัง
        return new Response("ok");
    };
}
```

`api/_lib/store.mjs`
```js
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { decideQuota } from "./rateLimit.mjs";

// ที่เก็บข้อมูลของบอทบน Firestore (admin SDK) — interface เดียวกับ createFakeStore ใน testing/fakes.mjs
// ทุกอย่างที่ต้องเปลี่ยนพร้อมกันทำใน transaction เดียว (applyDraft, consumeQuota)
const ALREADY_EXISTS = 6;
const toDate = (v) => (v instanceof Timestamp ? v.toDate() : v);

export function createFirestoreStore(db) {
    const drafts = db.collection("lineDrafts");
    const txRef = (id) => db.collection("transactions").doc(id);

    return {
        async findLink(lineUserId) {
            const snap = await db.collection("lineLinks").doc(lineUserId).get();
            return snap.exists ? snap.data() : null;
        },

        async consumeQuota(uid, ctx) {
            const ref = db.collection("lineUsage").doc(uid);
            return db.runTransaction(async (tx) => {
                const snap = await tx.get(ref);
                const { decision, next } = decideQuota(snap.exists ? snap.data() : undefined, ctx);
                if (next) tx.set(ref, next);
                return decision;
            });
        },

        async getWords(uid) {
            const snap = await db.collection("lineDicts").doc(uid).get();
            return (snap.exists && snap.data().words) || {};
        },

        // ใช้ composite index lineDrafts: userId ASC, expiresAt ASC
        async deleteExpiredDrafts(uid, now) {
            const snap = await drafts.where("userId", "==", uid).where("expiresAt", "<=", now).limit(50).get();
            if (snap.empty) return;
            const batch = db.batch();
            snap.docs.forEach((d) => batch.delete(d.ref));
            await batch.commit();
        },

        async createDraft(id, draft) {
            try {
                await drafts.doc(id).create(draft);
                return true;
            } catch (err) {
                if (err.code === ALREADY_EXISTS) return false;
                throw err;
            }
        },

        async getDraft(id) {
            const snap = await drafts.doc(id).get();
            if (!snap.exists) return null;
            const d = snap.data();
            return { ...d, createdAt: toDate(d.createdAt), expiresAt: toDate(d.expiresAt) };
        },

        newTxId() {
            return db.collection("transactions").doc().id;
        },

        async applyDraft(id, expectedVersion, ops) {
            const ref = drafts.doc(id);
            return db.runTransaction(async (tx) => {
                // อ่านทั้งหมดก่อนเขียน (กฎของ Firestore transaction)
                const snap = await tx.get(ref);
                if (!snap.exists || snap.data().version !== expectedVersion) return { ok: false, missing: [] };
                const updateSnaps = ops.updates.length ? await tx.getAll(...ops.updates.map((u) => txRef(u.id))) : [];

                const missing = [];
                tx.set(ref, { ...ops.draft, version: expectedVersion + 1 });
                for (const c of ops.creates) tx.set(txRef(c.id), { ...c.data, createdAt: FieldValue.serverTimestamp() });
                updateSnaps.forEach((s, k) => {
                    if (s.exists) tx.update(s.ref, ops.updates[k].data);
                    else missing.push(ops.updates[k].id);
                });
                for (const txId of ops.deletes) tx.delete(txRef(txId));
                if (ops.learn) {
                    tx.set(
                        db.collection("lineDicts").doc(ops.learn.uid),
                        { words: { [ops.learn.word]: ops.learn.category } },
                        { merge: true }
                    );
                }
                return { ok: true, missing };
            });
        },

        // ใช้ composite index transactions: userId ASC, date ASC
        async monthTotals(uid, start, end) {
            const snap = await db
                .collection("transactions")
                .where("userId", "==", uid)
                .where("date", ">=", start)
                .where("date", "<", end)
                .get();
            let income = 0;
            let expense = 0;
            snap.forEach((d) => {
                const t = d.data();
                if (t.type === "income") income += t.amount;
                else expense += t.amount;
            });
            return { income, expense };
        },

        // เหมือน budgetFor ใน src/utils/useFinanceData.js
        async getBudget(uid, key) {
            const snap = await db.collection("budgets").doc(uid).get();
            if (!snap.exists) return 0;
            const b = snap.data();
            const m = b.monthly?.[key];
            return m !== undefined && m !== null ? Number(m) : Number(b.budget) || 0;
        },
    };
}
```

`api/line/webhook.mjs`
```js
import { createWebhookHandler } from "../_lib/webhookRoute.mjs";
import { createFirestoreStore } from "../_lib/store.mjs";
import { adminDb } from "../_lib/firebaseAdmin.mjs";
import { config } from "../_lib/config.mjs";

export async function POST(request) {
    const handle = createWebhookHandler({
        channelSecret: config.lineChannelSecret(),
        accessToken: config.lineAccessToken(),
        store: createFirestoreStore(adminDb()),
        limits: config.limits(),
    });
    return handle(request);
}
```

- [ ] **Step 4: รันเทสต์ให้ผ่าน**

Run: `npm run test:server`
Expected: PASS ทุกเทสต์

- [ ] **Step 5: เช็กว่าไฟล์ endpoint และ store import ได้**

Run: `node -e "Promise.all([import('./api/line/webhook.mjs'), import('./api/_lib/store.mjs')]).then(() => console.log('ok'))"`
Expected: `ok`

- [ ] **Step 6: Commit**

```bash
git add api/_lib/store.mjs api/_lib/lineApi.mjs api/_lib/lineApi.test.mjs api/_lib/webhookRoute.mjs api/_lib/webhookRoute.test.mjs api/line/webhook.mjs
git commit -m "Add Firestore store, LINE reply API and webhook endpoint" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 15: เอกสาร, ตรวจรอบสุดท้าย และทดสอบจริง

**Files:**
- Modify: `README.md`, `PRODUCT.md`

- [ ] **Step 1: แก้ README ส่วน "🚀 เริ่มใช้ใน 3 ขั้นตอน"** เปลี่ยนข้อ 2 เป็น:

```markdown
2. **กด "เข้าสู่ระบบด้วย LINE"** (แนะนำ จดผ่านแชท LINE ได้ด้วย) หรือ **"สมัครสมาชิก"** ด้วยอีเมลและรหัสผ่าน (อย่างน้อย 6 ตัว)
```

- [ ] **Step 2: เพิ่มส่วนใหม่ใน README** ต่อจากย่อหน้า "**บนมือถือ:** ลองติดตั้งเป็นแอป..." (ก่อน `## 🔒 ข้อมูลของคุณ`)

```markdown
## 💬 จดผ่านแชท LINE

1. เข้าสู่ระบบด้วย LINE (หรือ **ตั้งค่า → LINE → เชื่อมบัญชี LINE** ถ้าใช้บัญชีอีเมล) แล้วกดเพิ่มเพื่อนบอท
2. พิมพ์ในแชทได้เลย ข้อความเดียวมีหลายรายการได้ เช่น `ค่าข้าวตอนกลางวัน 50 บาท ค่าน้ำ 100 บาท ค่าเน็ต 20 บาท`
3. บอทแสดงรายการพร้อมหมวดที่เดาได้ แล้วถามว่า **เป็นของวันไหน** กด **วันนี้ / เมื่อวาน / เลือกวัน…**
4. คำที่บอทไม่รู้จัก (เช่น `ค่าแมว 300`) บอทจะให้เลือกหมวด และจำไว้ใช้ครั้งหน้า ถ้าเดาผิด กด **แก้หมวด** ระบบก็จำเหมือนกัน
5. กด **เลิกทำ** เพื่อลบรายการที่เพิ่งจดจากข้อความนั้น หรือพิมพ์ `สรุป` เพื่อดูยอดเดือนนี้

พิมพ์วันมาด้วยได้ บอทจะบันทึกทันทีไม่ต้องถาม เช่น `เมื่อวาน ค่าแท็กซี่ 120`, `12/10 ค่าข้าว 50`, `12 ต.ค. ค่าข้าว 50`
```

- [ ] **Step 3: เพิ่มส่วนตั้งค่าใน README** ต่อจาก `### ตั้งค่า Firebase` (ก่อน `### นำขึ้นเว็บจริง (Vercel)`)

````markdown
### ตั้งค่า LINE (LINE Login + บอท)

1. **LINE Developers Console** ([developers.line.biz/console](https://developers.line.biz/console/))
   - สร้าง **Provider** 1 อัน
   - สร้าง **LINE Login channel** ใต้ Provider นี้ แล้วใส่ Callback URL ทั้ง 3 ตัว: `https://<โดเมน>/api/auth/line/callback`, URL ของ preview (เช่น `https://<โปรเจกต์>-git-<branch>-<ทีม>.vercel.app/api/auth/line/callback`) และ `http://localhost:3000/api/auth/line/callback`
   - สร้าง **Messaging API channel** ใต้ **Provider เดียวกัน** (ถ้าคนละ Provider ระบบจะไม่รู้ว่าแชทเป็นของบัญชีไหน) ตั้ง Webhook URL เป็น `https://<โดเมน>/api/line/webhook` แล้วเปิด **Use webhook** และออก Channel access token (long-lived)
   - ที่ LINE Login channel → **Linked LINE Official Account** เลือก OA ของบอท (ต้องผูกถึงจะขึ้นหน้าเพิ่มเพื่อนตอน login)
2. **LINE Official Account Manager**: ปิด **Auto-reply messages** และ **Greeting messages** ไม่อย่างนั้นจะตอบซ้ำกับบอท
3. **Firebase Console**:
   - Project settings → Service accounts → **Generate new private key**
   - Firestore → Indexes สร้าง composite index 2 ตัว คือ `transactions`: `userId` ↑ `date` ↑ และ `lineDrafts`: `userId` ↑ `expiresAt` ↑
   - วาง `firestore.rules` ใหม่แล้วกด **Publish** **ก่อน** deploy
4. **Vercel → Settings → Environment Variables**

| ชื่อ | ค่า |
|---|---|
| `LINE_LOGIN_CHANNEL_ID` / `LINE_LOGIN_CHANNEL_SECRET` | จาก LINE Login channel |
| `LINE_CHANNEL_SECRET` / `LINE_CHANNEL_ACCESS_TOKEN` | จาก Messaging API channel |
| `FIREBASE_SERVICE_ACCOUNT` | เนื้อหาไฟล์ JSON ของ service account ทั้งไฟล์ |
| `AUTH_COOKIE_SECRET` | ข้อความสุ่มยาว ๆ เช่น ผลจาก `node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"` |
| `REACT_APP_LINE_ADD_FRIEND_URL` | ลิงก์เพิ่มเพื่อนบอท เช่น `https://line.me/R/ti/p/@xxxx` |
| `LINE_LIMIT_PER_MINUTE` / `LINE_LIMIT_PER_DAY` | (ไม่ใส่ก็ได้) ค่าเริ่มต้น 20 และ 300 |

**ปรับเกณฑ์จำกัดรายคน:** เปิด Firestore → `lineUsage/{uid}` แล้วเพิ่ม field `limitPerDay` หรือ `limitPerMinute` (ตัวเลข) ใส่ `0` เพื่อระงับการใช้บอทของคนนั้น

**รันบนเครื่องพร้อม `/api`:** `npm start` ไม่มี `/api` ให้ใช้ `npx vercel dev` แทน (ใส่ค่าลับไว้ใน `.env.local`) ถ้าจะลอง webhook บนเครื่อง ต้องเปิด tunnel (เช่น `cloudflared tunnel --url http://localhost:3000`) แล้วชี้ Webhook URL ไปที่ tunnel

**เทสต์:** `npm test` (หน้าเว็บ) และ `npm run test:server` (ฝั่ง server ใช้ `node --test` ต้องใช้ Node 22 ขึ้นไป)
````

- [ ] **Step 4: เพิ่มแถวในตาราง "โครงสร้างข้อมูลใน Firestore" ของ README**

```markdown
| `lineLinks/{lineUserId}` | การผูก LINE กับบัญชี: `userId`, `displayName`, `linkedAt` |
| `lineDicts/{uid}` | คำที่ผู้ใช้สอนบอท: `words` (`{"ค่าแมว": "other"}`) |
| `lineDrafts/{messageId}` | รายการจากแชทที่รอเลือกวัน/หมวด และ id ของรายการที่บันทึกแล้ว (หมดอายุ 7 วัน) |
| `lineUsage/{uid}` | ตัวนับจำกัดการใช้บอทต่อนาที/ต่อวัน (หน้าเว็บอ่านไม่ได้) |
```

ในบล็อกโค้ดของส่วน "โครงสร้างโปรเจกต์" ของ README:
- เปลี่ยนบรรทัด `├── pages/            หน้าหลัก: Login, Register, Dashboard, Settings` เป็น `├── pages/            หน้าหลัก: Login, Register, Dashboard, Settings, LineCallback (/auth/line)`
- เปลี่ยนบรรทัด `└── firebase/                   config, ข้อความ error ภาษาไทย, เพิ่ม/ลบรายการแบบเลิกทำได้` เป็น `└── firebase/                   config, ข้อความ error ภาษาไทย, เพิ่ม/ลบรายการแบบเลิกทำได้, เริ่ม LINE Login`
- เพิ่มบรรทัดเหล่านี้ก่อน `public/service-worker.js` (ปิดบล็อกเดิมด้วยบรรทัดใหม่ที่จัดแนวเหมือนเดิม):

```
api/
├── auth/line/start.mjs         เริ่ม LINE Login (ส่ง URL + cookie state)
├── auth/line/callback.mjs      LINE ส่งกลับมา -> หา/สร้าง/ผูกบัญชี -> custom token
├── line/webhook.mjs            รับข้อความจากบอท LINE
└── _lib/                       ตรรกะทั้งหมด (parse.mjs แยกข้อความ, bot.mjs ขั้นตอนในแชท, store.mjs Firestore) + เทสต์ *.test.mjs
```

- [ ] **Step 5: แก้ `PRODUCT.md`** ในส่วน `## Capabilities and Constraints`

- บรรทัด Routes เปลี่ยนเป็น: ``- Routes: `/` login (LINE button first, then email; password-reset dialog), `/register`, `/auth/line` (finishes LINE sign-in), `/dashboard`, `/settings`.``
- เพิ่ม bullet: `- LINE: sign in or link LINE in Settings; a LINE bot logs income/expense from chat (multi-item messages, auto category from a keyword dictionary plus per-user learned words, asks the date before saving, undo, "สรุป" monthly summary, per-user rate limits). Reply messages only (free).`
- บรรทัด Stack ต่อท้ายด้วย: `, Vercel Functions (ESM, firebase-admin) for LINE Login and the LINE webhook.`

- [ ] **Step 6: ตรวจทั้งหมดรอบสุดท้าย**

Run: `npm run test:server`
Expected: PASS ทุกเทสต์ ไม่มี fail

Run: `CI=true npm test -- --watchAll=false`
Expected: PASS ทุกเทสต์

Run: `CI=true npm run build`
Expected: `Compiled successfully.`

- [ ] **Step 7: ให้ reviewer ตรวจ** โดยเรียก agent `security-reviewer` (ดู `api/`, `firestore.rules`, `vercel.json`, `src/firebase/lineAuth.js`, `src/pages/LineCallback.js`) และ `usability-reviewer` (ดูหน้า login, register และตั้งค่า รวมถึงข้อความของบอทใน `api/_lib/messages.mjs`) แล้วแก้ประเด็นที่สำคัญก่อน commit

- [ ] **Step 8: Commit เอกสาร**

```bash
git add README.md PRODUCT.md
git commit -m "Document LINE setup, chat logging and new Firestore collections" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

- [ ] **Step 9: ทดสอบจริงบน Vercel preview** (ต้องให้เจ้าของโปรเจกต์ทำขั้นตอนใน README "ตั้งค่า LINE" ก่อน) push branch แล้วใช้ URL preview ของ branch ไล่ตามรายการนี้ทีละข้อ แล้วบันทึกผล ✓/✗ ทุกข้อ:

1. login ใหม่ด้วย LINE → ขึ้นหน้าเพิ่มเพื่อนบอท → มาถึง dashboard ชื่อตรงกับ LINE และไม่มีแถบ "ยังไม่ได้ยืนยันอีเมล"
2. ส่ง `ค่าข้าวตอนกลางวัน 50 บาท ค่าน้ำ 100 บาท ค่าเน็ต 20 บาท` → การ์ดแสดง 3 รายการ (อาหาร/เครื่องดื่ม, ค่าน้ำ/ไฟ/เน็ต/โทรศัพท์ ×2) → กด "วันนี้" → เห็น 3 รายการใน dashboard
3. ส่ง `ค่าแมว 300` → เลือกวัน → เลือกหมวด "อื่นๆ" → ส่ง `เมื่อวาน ค่าแมว 200` → บันทึกเป็น "อื่นๆ" ทันทีโดยไม่ถาม
4. กด "แก้หมวด" ที่การ์ดใบหนึ่ง → หมวดใน dashboard เปลี่ยน
5. กด "เลิกทำ" → รายการหายจาก dashboard
6. ส่ง `สรุป` → ยอดตรงกับ dashboard
7. ส่งข้อความสองข้อความติดกันโดยไม่กดวัน แล้วกลับไปกดปุ่มวันบนการ์ดใบแรก → บันทึกได้
8. แก้ `lineUsage/{uid}.limitPerMinute` เป็น `2` แล้วส่ง 4 ข้อความเร็ว ๆ → ได้คำเตือนครั้งเดียว ข้อความที่ 4 เงียบ (เสร็จแล้วลบ field นี้)
9. login ด้วยบัญชีอีเมล → ตั้งค่า → เชื่อมบัญชี LINE ด้วย LINE อีกบัญชีหนึ่ง → toast "เชื่อมบัญชี LINE แล้ว" → จดจากแชทของ LINE นั้นเข้าบัญชีอีเมลนี้
10. บัญชีอีเมลอีกบัญชีลองเชื่อม LINE ที่ผูกไปแล้ว → toast "LINE นี้เชื่อมกับบัญชีอื่นอยู่แล้ว"
11. ยกเลิกการเชื่อม → ส่งข้อความในแชท → บอทตอบว่ายังไม่ได้เชื่อมบัญชี
12. บัญชี LINE อย่างเดียว: รอเกิน 4 นาทีแล้วกดลบบัญชี → ขึ้นปุ่ม "เข้าสู่ระบบด้วย LINE อีกครั้ง" และข้อมูลยังอยู่ครบ → login ใหม่ → ลบสำเร็จ → `lineLinks`, `lineDicts`, `lineDrafts` ของบัญชีนี้หายหมด
13. กดยกเลิกที่หน้า consent ของ LINE → กลับมาหน้า login พร้อมข้อความ "ยกเลิกการเข้าสู่ระบบด้วย LINE"
14. ใน log ของ Vercel ต้องไม่มี custom token, ID token หรือข้อความที่ผู้ใช้พิมพ์

ถ้าข้อไหน ✗ ให้ใช้ superpowers:systematic-debugging หาต้นเหตุ เขียนเทสต์ที่ทำให้เห็นปัญหา แล้วแก้
