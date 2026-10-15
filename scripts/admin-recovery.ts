// Super-admin recovery, for when no super admin can sign in.
//
// Deliberately a command-line tool, not a web endpoint: running it requires
// the production DATABASE_URL, which only people who administer the
// infrastructure hold. It never prints, sets or reads a password — it issues
// a single-use, 1-hour password reset link that the owner opens themselves.
//
//   DATABASE_URL=... npx tsx scripts/admin-recovery.ts list
//   DATABASE_URL=... APP_URL=https://... npx tsx scripts/admin-recovery.ts reset-link <email>
//   DATABASE_URL=... npx tsx scripts/admin-recovery.ts promote <email> --yes
//
// `promote` makes an existing, active account a super admin (e.g. after the
// only super admin has left). Every action is written to the audit log.

import { prisma } from "../src/lib/prisma";
import { issueToken } from "../src/lib/auth/account-tokens";
import { appUrl } from "../src/lib/email";

async function audit(action: string, entityId: string, summary: string) {
  await prisma.auditLog.create({ data: { actorId: null, action, entityType: "user", entityId, summary: `${summary} (recovery CLI)` } });
}

async function main() {
  const [cmd, emailArg, flag] = process.argv.slice(2);
  const email = emailArg?.trim().toLowerCase();

  if (cmd === "list") {
    const admins = await prisma.user.findMany({ where: { role: "FOUNDER" }, select: { email: true, status: true, lastLoginAt: true } });
    if (admins.length === 0) console.log("No super admins. If the users table is empty, use /setup with SETUP_TOKEN instead.");
    for (const a of admins) console.log(`${a.email}\t${a.status}\tlast sign-in ${a.lastLoginAt?.toISOString() ?? "never"}`);
    return;
  }

  if (!email) throw new Error("Usage: admin-recovery.ts list | reset-link <email> | promote <email> --yes");
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) throw new Error(`No account for ${email}.`);

  if (cmd === "reset-link") {
    if (user.status !== "ACTIVE") throw new Error(`Account is ${user.status}; reactivate it first (promote --yes reactivates).`);
    const { token, expiresAt } = await issueToken(user.id, "PASSWORD_RESET", null);
    await audit("recovery.reset_link", user.id, `Issued password reset link for ${email}`);
    console.log(`Single-use reset link for ${email} (expires ${expiresAt.toISOString()}). Give it only to the account owner:\n`);
    console.log(`${appUrl()}/reset-password?token=${encodeURIComponent(token)}`);
    return;
  }

  if (cmd === "promote") {
    if (flag !== "--yes") throw new Error(`This makes ${email} a super admin with full access. Re-run with --yes to confirm.`);
    if (!user.passwordHash) throw new Error("This account has never set a password; accept the invitation first.");
    await prisma.user.update({ where: { id: user.id }, data: { role: "FOUNDER", status: "ACTIVE" } });
    await audit("recovery.promote", user.id, `Promoted ${email} to Super Admin (was ${user.role}, ${user.status})`);
    console.log(`${email} is now an active super admin. Run reset-link if they also need a new password.`);
    return;
  }

  throw new Error(`Unknown command "${cmd}".`);
}

main()
  .catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
