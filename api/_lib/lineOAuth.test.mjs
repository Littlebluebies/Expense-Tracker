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
