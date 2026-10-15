import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizeDatabaseUrl, withConnectTimeout } from "./db-url";

const pooled = "postgresql://postgres.ref:p%23ss@aws-0-ap-southeast-2.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=1";

test("adds connect_timeout and keeps existing params and encoded password", () => {
  const out = new URL(withConnectTimeout(pooled, 15)!);
  assert.equal(out.searchParams.get("connect_timeout"), "15");
  assert.equal(out.searchParams.get("pgbouncer"), "true");
  assert.equal(out.searchParams.get("connection_limit"), "1");
  assert.equal(out.password, "p%23ss");
  assert.equal(out.port, "6543");
});

test("respects an explicit connect_timeout", () => {
  const url = pooled + "&connect_timeout=60";
  assert.equal(withConnectTimeout(url, 15), url);
});

test("leaves missing or unparseable values alone", () => {
  assert.equal(withConnectTimeout(undefined, 15), undefined);
  assert.equal(withConnectTimeout("not a url", 15), "not a url");
});

test("normalizeDatabaseUrl mirrors the build-time repairs", () => {
  const host = "aws-0-ap-southeast-2.pooler.supabase.com";
  assert.equal(
    normalizeDatabaseUrl(` postgresql://postgres.ref:\n pw \n@${host}:6543/postgres\n`),
    `postgresql://postgres.ref:pw@${host}:6543/postgres?pgbouncer=true&connection_limit=1`,
  );
  assert.equal(normalizeDatabaseUrl(pooled), pooled);
  assert.equal(normalizeDatabaseUrl(undefined), undefined);
});
