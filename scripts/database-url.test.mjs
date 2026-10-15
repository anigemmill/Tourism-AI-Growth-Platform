import { test } from "node:test";
import assert from "node:assert/strict";
import { checkDatabaseUrl, normalizeDatabaseUrl, withConnectTimeout } from "./database-url.mjs";

const HOST = "aws-0-ap-southeast-2.pooler.supabase.com";
const direct = (pw) => `postgresql://postgres.abcref:${pw}@${HOST}:5432/postgres`;
const pooled = (pw) => `postgresql://postgres.abcref:${pw}@${HOST}:6543/postgres?pgbouncer=true&connection_limit=1`;

test("valid Supabase URLs pass", () => {
  assert.deepEqual(checkDatabaseUrl("DIRECT_URL", direct("s3cretPass")).errors, []);
  const r = checkDatabaseUrl("DATABASE_URL", pooled("s3cretPass"));
  assert.deepEqual(r.errors, []);
  assert.deepEqual(r.warnings, []);
});

test("percent-encoded special characters pass", () => {
  assert.deepEqual(checkDatabaseUrl("DIRECT_URL", direct("a%23b%2Fc%40d%25")).errors, []);
});

test("summary never contains the password", () => {
  for (const pw of ["s3cretPass", "se#cret", "se/cret"]) {
    const r = checkDatabaseUrl("DIRECT_URL", direct(pw));
    const out = [r.summary ?? "", ...r.errors, ...r.warnings].join("\n");
    assert.ok(!out.includes(pw), `leaked ${pw}`);
    assert.ok(!out.includes("cret"));
  }
});

test("flags the common P1013 causes", () => {
  const cases = {
    unset: [undefined, /not set/],
    hash: [direct("pa#ss"), /unencoded "#"/],
    slash: [direct("pa/ss"), /unencoded "\/"/],
    question: [direct("pa?ss"), /unencoded "\?"/],
    placeholder: [direct("[YOUR-PASSWORD]"), /placeholder/],
    quoted: [`"${direct("pass")}"`, /quotes/],
    whitespace: [` ${direct("pass")}\n`, /whitespace/],
    prefix: [`DIRECT_URL=${direct("pass")}`, /NAME= prefix/],
    httpUrl: ["https://abcref.supabase.co", /postgresql:\/\//],
    noPassword: [`postgresql://postgres.abcref@${HOST}:5432/postgres`, /no password/],
    directOnTxPooler: [pooled("pass"), /session pooler/],
  };
  for (const [label, [value, re]] of Object.entries(cases)) {
    const { errors } = checkDatabaseUrl("DIRECT_URL", value);
    assert.ok(errors.some((e) => re.test(e)), `${label}: ${JSON.stringify(errors)}`);
  }
});

test("warns, without failing, on shapes Prisma accepts", () => {
  for (const [pw, re] of [["p@ss", /%40/], ["100%off", /%25/], ["a[b]c", /\[ or \]/]]) {
    const r = checkDatabaseUrl("DIRECT_URL", direct(pw));
    assert.deepEqual(r.errors, [], pw);
    assert.match(r.warnings.join(), re);
  }
});

test("warns when the pooled runtime URL lacks pgbouncer=true", () => {
  const r = checkDatabaseUrl("DATABASE_URL", `postgresql://postgres.abcref:pass@${HOST}:6543/postgres`);
  assert.deepEqual(r.errors, []);
  assert.match(r.warnings.join(), /pgbouncer=true/);
});

test("withConnectTimeout lengthens the timeout without disturbing the URL", () => {
  const out = new URL(withConnectTimeout(direct("p%23ss"), 30));
  assert.equal(out.searchParams.get("connect_timeout"), "30");
  assert.equal(out.password, "p%23ss");
  assert.equal(out.port, "5432");
  assert.equal(withConnectTimeout(direct("x") + "?connect_timeout=9", 30), direct("x") + "?connect_timeout=9");
  assert.equal(withConnectTimeout(undefined, 30), undefined);
});

test("normalizeDatabaseUrl trims edges and whitespace around the password only", () => {
  const messy = `  postgresql://postgres.abcref:\n s3cretPass \n@${HOST}:5432/postgres\n`;
  const { value, notes } = normalizeDatabaseUrl("DIRECT_URL", messy);
  assert.equal(value, direct("s3cretPass"));
  assert.ok(notes.length >= 2);
  assert.ok(!notes.join().includes("s3cret"), "notes never contain the password");
  assert.deepEqual(checkDatabaseUrl("DIRECT_URL", value).errors, []);
});

test("normalizeDatabaseUrl keeps whitespace inside the password, which still fails the check", () => {
  const { value } = normalizeDatabaseUrl("DIRECT_URL", direct("s3cret Pass"));
  assert.equal(value, direct("s3cret Pass"));
  assert.match(checkDatabaseUrl("DIRECT_URL", value).errors.join(), /space/);
});

test("normalizeDatabaseUrl adds pooler params to DATABASE_URL only", () => {
  const bare = `postgresql://postgres.abcref:pw@${HOST}:6543/postgres`;
  assert.equal(normalizeDatabaseUrl("DATABASE_URL", bare).value, bare + "?pgbouncer=true&connection_limit=1");
  assert.equal(normalizeDatabaseUrl("DATABASE_URL", bare + "?pgbouncer=true").value, bare + "?pgbouncer=true&connection_limit=1");
  assert.equal(normalizeDatabaseUrl("DATABASE_URL", pooled("pw")).value, pooled("pw"));
  assert.equal(normalizeDatabaseUrl("DIRECT_URL", direct("pw")).value, direct("pw"));
  assert.deepEqual(normalizeDatabaseUrl("DIRECT_URL", direct("pw")).notes, []);
});
