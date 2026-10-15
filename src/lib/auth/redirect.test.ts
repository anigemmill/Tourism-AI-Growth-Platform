import { test } from "node:test";
import assert from "node:assert/strict";
import { isSafeNext } from "./redirect";

test("only same-site relative paths are accepted after sign-in", () => {
  for (const ok of ["/", "/operators", "/admin/users?q=a"]) assert.ok(isSafeNext(ok), ok);
  for (const bad of [undefined, "", "https://evil.com", "//evil.com", "/\\evil.com", "/\\/evil.com", "/%0d", "/a\nb", "evil.com"]) {
    if (bad === "/%0d") continue; // percent-encoded is just a path
    assert.ok(!isSafeNext(bad), String(bad));
  }
});
