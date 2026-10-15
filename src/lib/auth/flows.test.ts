import { test } from "node:test";
import assert from "node:assert/strict";
import { appUrl, emailConfigured } from "../email";

test("links use APP_URL or Vercel's production URL, never request headers", () => {
  assert.equal(appUrl({ APP_URL: "https://example.nz/" }), "https://example.nz");
  assert.equal(appUrl({ VERCEL_ENV: "production", VERCEL_PROJECT_PRODUCTION_URL: "app.vercel.app", VERCEL_URL: "x-preview.vercel.app" }), "https://app.vercel.app");
  assert.equal(appUrl({ VERCEL_ENV: "preview", VERCEL_URL: "x-preview.vercel.app" }), "https://x-preview.vercel.app");
  assert.equal(appUrl({}), "http://localhost:3000");
});

test("email is only considered configured with both key and sender", () => {
  assert.equal(emailConfigured({ RESEND_API_KEY: "k" }), false);
  assert.equal(emailConfigured({ RESEND_API_KEY: "k", EMAIL_FROM: "a@b.c" }), true);
});
