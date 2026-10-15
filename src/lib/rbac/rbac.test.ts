import { test } from "node:test";
import assert from "node:assert/strict";
import { ALL_PERMISSIONS, assignable, assignableRoles, effectivePermissions, isStaffUser, PERMISSIONS, ROLE_DEFAULTS } from "./permissions";
import { enabledFeatures } from "./features";

test("super admin always holds every permission, whatever the overrides", () => {
  assert.deepEqual(effectivePermissions("FOUNDER", [{ permission: "users.view", granted: false }], [{ permission: "billing.view", granted: false }]), ALL_PERMISSIONS);
});

test("least-privilege defaults", () => {
  const analyst = effectivePermissions("ANALYST");
  assert.ok(analyst.every((p) => !p.endsWith(".edit") && !p.endsWith(".manage")), "analysts are read-only");
  assert.ok(!analyst.includes("users.view") && !analyst.includes("billing.view") && !analyst.includes("data.export"));
  const admin = effectivePermissions("ADMIN");
  assert.ok(!admin.includes("users.manage") && !admin.includes("billing.view") && !admin.includes("commercial.view"));
  assert.deepEqual(effectivePermissions("OPERATOR"), ["portal.access", "portal.signals"]);
});

test("role overrides then user overrides apply in order", () => {
  const p = effectivePermissions("ANALYST", [{ permission: "data.export", granted: true }], [{ permission: "data.export", granted: false }, { permission: "reports.view", granted: false }]);
  assert.ok(!p.includes("data.export"));
  assert.ok(!p.includes("reports.view"));
  assert.ok(effectivePermissions("ANALYST", [{ permission: "data.export", granted: true }]).includes("data.export"));
});

test("operators can never be given staff permissions, and staff never portal ones", () => {
  for (const p of ALL_PERMISSIONS) {
    assert.equal(assignable("OPERATOR", p), PERMISSIONS[p].scope === "tenant", p);
  }
  const op = effectivePermissions("OPERATOR", [{ permission: "operators.view", granted: true }], [{ permission: "billing.manage", granted: true }]);
  assert.ok(op.every((p) => PERMISSIONS[p].scope === "tenant"));
  assert.equal(isStaffUser({ role: "OPERATOR", permissions: op }), false);
  assert.ok(!effectivePermissions("ADMIN", [], [{ permission: "portal.access", granted: true }]).includes("portal.access"));
});

test("role assignment is reserved for super admins", () => {
  for (const r of ["ADMIN", "PROGRAMME_MANAGER", "ANALYST"] as const) {
    assert.ok(!effectivePermissions(r, [{ permission: "users.roles", granted: true }], [{ permission: "users.roles", granted: true }]).includes("users.roles"));
  }
  assert.ok(!assignableRoles("ADMIN").includes("FOUNDER"));
  assert.ok(assignableRoles("FOUNDER").includes("FOUNDER"));
});

test("unknown permission keys are ignored", () => {
  assert.deepEqual(effectivePermissions("ANALYST", [{ permission: "everything", granted: true }]), effectivePermissions("ANALYST"));
});

test("role defaults only contain assignable permissions", () => {
  for (const [role, perms] of Object.entries(ROLE_DEFAULTS)) {
    for (const p of perms) assert.ok(assignable(role as keyof typeof ROLE_DEFAULTS, p) || role === "FOUNDER", `${role}:${p}`);
  }
});

test("business features default on and honour overrides", () => {
  assert.deepEqual(enabledFeatures([]), ["portal.dashboard", "portal.collective", "portal.signals"]);
  assert.deepEqual(enabledFeatures([{ feature: "portal.collective", enabled: false }, { feature: "bogus", enabled: true }]), ["portal.dashboard", "portal.signals"]);
});
