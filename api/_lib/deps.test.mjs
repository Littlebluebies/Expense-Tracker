import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";

// Vercel's function loader does not support require() of ES modules.
// firebase-admin 14 -> jwks-rsa 4 -> jose 6 (ESM only) crashed every /api function on Vercel,
// so the firebase-admin dependency chain must load with require(esm) turned off.
test("firebase-admin dependencies load without require(esm)", () => {
    const script = "require('firebase-admin/app'); require('firebase-admin/auth'); require('firebase-admin/firestore'); require('jwks-rsa');";
    assert.doesNotThrow(() =>
        execFileSync(process.execPath, ["--no-experimental-require-module", "-e", script], { stdio: "pipe" })
    );
});
