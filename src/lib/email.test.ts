import { test } from "node:test";
import assert from "node:assert/strict";
import { appUrlProblem, classifyResendError, sendEmail, senderDomain } from "./email";

// Error bodies in the shape Resend returns (https://resend.com/docs/api-reference/errors).
const RESEND = {
  invalidKey: [403, { name: "invalid_api_key", message: "API key is invalid" }],
  missingKey: [401, { name: "missing_api_key", message: "Missing API key in the authorization header." }],
  restrictedKey: [401, { name: "restricted_api_key", message: "This API key is restricted to only send emails" }],
  domainUnverified: [403, { name: "validation_error", message: "The theoutsidein.nz domain is not verified. Please, add and verify your domain on https://resend.com/domains" }],
  testingOnly: [403, { name: "validation_error", message: "You can only send testing emails to your own email address (owner@example.com). To send emails to other recipients, please verify a domain at resend.com/domains, and change the `from` address to an email using this domain." }],
  badFrom: [422, { name: "invalid_from_address", message: "Invalid `from` field." }],
  rateLimited: [429, { name: "rate_limit_exceeded", message: "Too many requests." }],
  quota: [429, { name: "daily_quota_exceeded", message: "You have reached your daily email sending quota." }],
  outage: [500, { name: "internal_server_error", message: "An unexpected error occurred." }],
} as const;

test("Resend errors are classified into causes someone can act on", () => {
  const expected: Record<keyof typeof RESEND, string> = {
    invalidKey: "api_key", missingKey: "api_key", restrictedKey: "api_key",
    domainUnverified: "sender_not_verified", testingOnly: "testing_mode", badFrom: "invalid_sender",
    rateLimited: "rate_limited", quota: "rate_limited", outage: "unavailable",
  };
  for (const [k, [status, body]] of Object.entries(RESEND) as [keyof typeof RESEND, (typeof RESEND)[keyof typeof RESEND]][]) {
    assert.equal(classifyResendError(status, body.name, body.message), expected[k], k);
  }
  // An HTTP 403 alone doesn't say which: the body decides.
  assert.equal(classifyResendError(403), "rejected");
});

async function withResend<T>(status: number, body: unknown, fn: (logs: string[]) => Promise<T>): Promise<T> {
  const saved = { fetch: globalThis.fetch, error: console.error, key: process.env.RESEND_API_KEY, from: process.env.EMAIL_FROM };
  const logs: string[] = [];
  process.env.RESEND_API_KEY = "re_test_secret_value";
  process.env.EMAIL_FROM = "Findable <no-reply@theoutsidein.nz>";
  globalThis.fetch = (async () => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } })) as typeof fetch;
  console.error = (...a: unknown[]) => void logs.push(a.map(String).join(" "));
  try {
    return await fn(logs);
  } finally {
    globalThis.fetch = saved.fetch;
    console.error = saved.error;
    if (saved.key === undefined) delete process.env.RESEND_API_KEY; else process.env.RESEND_API_KEY = saved.key;
    if (saved.from === undefined) delete process.env.EMAIL_FROM; else process.env.EMAIL_FROM = saved.from;
  }
}

test("a failed send reports the cause and logs no secret, recipient, body or provider message", async () => {
  const [status, body] = RESEND.testingOnly;
  await withResend(status, body, async (logs) => {
    const res = await sendEmail({ to: "client@example.com", subject: "Invite", text: "https://app.example/invite?token=SECRET_TOKEN" });
    assert.deepEqual(res, { sent: false, reason: "failed", failure: "testing_mode", status: 403, providerError: "validation_error" });
    assert.equal(logs.length, 1);
    assert.match(logs[0], /HTTP 403 resend=validation_error failure=testing_mode from-domain=theoutsidein\.nz/);
    for (const leak of ["re_test_secret_value", "client@example.com", "SECRET_TOKEN", "owner@example.com"]) assert.ok(!logs[0].includes(leak), leak);
  });
});

test("a successful send is reported as sent", async () => {
  await withResend(200, { id: "abc" }, async (logs) => {
    assert.deepEqual(await sendEmail({ to: "a@b.nz", subject: "s", text: "t" }), { sent: true });
    assert.equal(logs.length, 0);
  });
});

test("a non-JSON error body still yields a classified failure", async () => {
  const saved = globalThis.fetch;
  await withResend(502, {}, async () => {
    globalThis.fetch = (async () => new Response("Bad gateway", { status: 502 })) as typeof fetch;
    const res = await sendEmail({ to: "a@b.nz", subject: "s", text: "t" });
    assert.equal(res.sent, false);
    assert.equal(res.sent === false && res.reason === "failed" && res.failure, "unavailable");
  });
  globalThis.fetch = saved;
});

test("sender domain is read from either address form", () => {
  assert.equal(senderDomain({ EMAIL_FROM: "Findable <no-reply@TheOutsideIn.nz>" }), "theoutsidein.nz");
  assert.equal(senderDomain({ EMAIL_FROM: "no-reply@theoutsidein.nz" }), "theoutsidein.nz");
  assert.equal(senderDomain({ EMAIL_FROM: "not-an-address" }), null);
  assert.equal(senderDomain({}), null);
});

test("production refuses to build account links without an explicit, https APP_URL", () => {
  // Today's Production: no APP_URL, and Vercel's fallback would be the main website's domain.
  assert.match(appUrlProblem({ VERCEL_ENV: "production", VERCEL_PROJECT_PRODUCTION_URL: "theoutsidein.nz" }) ?? "", /APP_URL isn't set/);
  assert.equal(appUrlProblem({ VERCEL_ENV: "production", APP_URL: "https://app.theoutsidein.nz" }), null);
  assert.equal(appUrlProblem({ VERCEL_ENV: "production", APP_URL: "https://app.theoutsidein.nz/" }), null);
  assert.match(appUrlProblem({ VERCEL_ENV: "production", APP_URL: "http://app.theoutsidein.nz" }) ?? "", /https/);
  assert.match(appUrlProblem({ VERCEL_ENV: "production", APP_URL: "https://app.theoutsidein.nz/login" }) ?? "", /base address/);
  assert.match(appUrlProblem({ APP_URL: "not a url" }) ?? "", /valid URL/);
  // Previews and local development keep their automatic fallback.
  assert.equal(appUrlProblem({ VERCEL_ENV: "preview", VERCEL_URL: "x.vercel.app" }), null);
  assert.equal(appUrlProblem({ APP_URL: "http://localhost:3000" }), null);
  assert.equal(appUrlProblem({}), null);
});
