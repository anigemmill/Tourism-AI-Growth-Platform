// Vercel build entrypoint (package.json "vercel-build").
// Production deployments apply pending migrations first; if a migration
// fails, the build fails and the previous deployment stays live.
// Preview deployments never migrate.

import { execSync, spawnSync } from "node:child_process";
import { checkDatabaseUrl, normalizeDatabaseUrl, withConnectTimeout } from "./database-url.mjs";

const run = (cmd, env = process.env) => execSync(cmd, { stdio: "inherit", env });
const env = process.env.VERCEL_ENV ?? "development";

run("npx prisma generate");
if (env === "production") {
  // Validate both URLs before Prisma sees them: a malformed one otherwise
  // fails migrate with an unexplained P1013.
  let failed = false;
  for (const name of ["DATABASE_URL", "DIRECT_URL"]) {
    const normalized = normalizeDatabaseUrl(name, process.env[name]);
    for (const n of normalized.notes) console.log(`Note: ${n}.`);
    process.env[name] = normalized.value;
    const { errors, warnings, summary } = checkDatabaseUrl(name, process.env[name]);
    if (summary) console.log(summary);
    for (const w of warnings) console.warn(`Warning: ${w}`);
    for (const e of errors) console.error(`Error: ${e}`);
    failed ||= errors.length > 0;
  }
  if (failed) {
    console.error("Fix the value(s) in Vercel → Settings → Environment Variables (Production), then redeploy. See docs/DEPLOYMENT.md.");
    process.exit(1);
  }
  console.log("Applying database migrations (production)…");
  // Longer connect timeout for the first connection to an idle database, and
  // one retry: `migrate deploy` is idempotent and takes an advisory lock.
  const migrateEnv = { ...process.env, DIRECT_URL: withConnectTimeout(process.env.DIRECT_URL, 30) };
  const migrate = () => {
    const r = spawnSync("npx", ["prisma", "migrate", "deploy"], { env: migrateEnv, encoding: "utf8" });
    process.stdout.write(r.stdout ?? "");
    process.stderr.write(r.stderr ?? "");
    return { ok: r.status === 0, authFailed: /\bP1000\b/.test(`${r.stdout}${r.stderr}`) };
  };
  let result = migrate();
  // Never retry a rejected password: it cannot succeed, and repeated failed
  // logins can get the build's IP temporarily banned by Supabase.
  if (!result.ok && !result.authFailed) {
    console.warn("Migration attempt failed; retrying once in 15 s…");
    execSync("sleep 15");
    result = migrate();
  }
  if (!result.ok) {
    if (result.authFailed) console.error("The database rejected the password in DIRECT_URL. Not retrying.");
    process.exit(1);
  }
} else {
  console.log(`Skipping migrations for VERCEL_ENV=${env}.`);
}
run("npx next build");
