import { test } from "node:test";
import assert from "node:assert/strict";
import { staffNav } from "./nav";
import { effectivePermissions } from "./rbac/permissions";

const all = effectivePermissions("FOUNDER");
const hrefs = (groups: ReturnType<typeof staffNav>) => groups.flatMap((g) => g.items.map((i) => i.href));
const labels = (groups: ReturnType<typeof staffNav>) => groups.map((g) => g.label);

test("Findable navigation drops the Rotorua pilot label and destination module", () => {
  const nav = staffNav(all, true, "findable");
  assert.ok(!labels(nav).includes("Rotorua pilot"));
  assert.ok(labels(nav).includes("Programme"));
  assert.ok(!hrefs(nav).includes("/destination"));
  assert.ok(hrefs(nav).includes("/admin/businesses"));
});

test("pilot navigation is unchanged", () => {
  const nav = staffNav(all, true, "outside-in");
  assert.ok(labels(nav).includes("Rotorua pilot"));
  assert.ok(hrefs(nav).includes("/destination"));
  assert.ok(hrefs(staffNav(all, false, "outside-in")).includes("/destination"));
});
