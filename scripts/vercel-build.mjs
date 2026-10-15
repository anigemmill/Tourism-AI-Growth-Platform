// Vercel build entrypoint (package.json "vercel-build").
// Production deployments apply pending migrations first; if a migration
// fails, the build fails and the previous deployment stays live.
// Preview deployments never migrate.

import { execSync } from "node:child_process";
import { checkDatabaseUrl, withConnectTimeout } from "./database-url.mjs";

const run = (cmd, env = process.env) => execSync(cmd, { stdio: "inherit", env });
const env = process.env.VERCEL_ENV ?? "development";

run("npx prisma generate");
if (env === "production") {
  // Validate both URLs before Prisma sees them: a malformed one otherwise
  // fails migrate with an unexplained P1013.
  let failed = false;
  for (const name of ["DATABASE_URL", "DIRECT_URL"]) {
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
  try {
    run("npx prisma migrate deploy", migrateEnv);
  } catch {
    console.warn("Migration attempt failed; retrying once in 15 s…");
    execSync("sleep 15");
    run("npx prisma migrate deploy", migrateEnv);
  }
} else {
  console.log(`Skipping migrations for VERCEL_ENV=${env}.`);
}
run("npx next build");
