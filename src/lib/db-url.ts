// Prisma gives up on a new connection after 5 s by default. On a serverless
// cold start the Supabase pooler can take longer to open a connection to an
// idle database, which fails the request with P1001. Lengthen it unless the
// URL already sets connect_timeout.
export function withConnectTimeout(value: string | undefined, seconds: number): string | undefined {
  if (!value) return value;
  try {
    const url = new URL(value);
    if (url.searchParams.has("connect_timeout")) return value;
    url.searchParams.set("connect_timeout", String(seconds));
    return url.toString();
  } catch {
    return value;
  }
}

// Same repairs as scripts/database-url.mjs normalizeDatabaseUrl, for the
// runtime client: trim whitespace at the ends and directly around the
// password, and add pgbouncer=true / connection_limit=1 on the Supabase
// transaction pooler. Whitespace inside the password is left as is.
export function normalizeDatabaseUrl(value: string | undefined): string | undefined {
  if (!value) return value;
  let v = value.trim();
  const m = /^(postgres(?:ql)?:\/\/)([^:@/\s]+):([\s\S]*)@([^@]*)$/.exec(v);
  if (m) {
    const [, scheme, user, password, rest] = m;
    v = `${scheme}${user}:${password.trim()}@${rest.replace(/^\s+/, "")}`;
  }
  if (/\.pooler\.supabase\.com:6543\//.test(v)) {
    const add: string[] = [];
    if (!/[?&]pgbouncer=/.test(v)) add.push("pgbouncer=true");
    if (!/[?&]connection_limit=/.test(v)) add.push("connection_limit=1");
    if (add.length) v += (v.includes("?") ? "&" : "?") + add.join("&");
  }
  return v;
}

// The production Supabase project. Must match PRODUCTION_DB_REF in
// scripts/database-url.mjs (a unit test checks they agree).
export const PRODUCTION_DB_REF = "hescoabpcjukmgeopjnq";

/**
 * Runtime guard for staging: outside a Production deployment (Vercel Preview
 * or Development), refuse to connect to the production project at all, so a
 * preview can never read or change production data, whatever its variables
 * say. Returns an error message, or null when the connection is allowed.
 * Local runs (no VERCEL_ENV) are not affected.
 */
export function productionDatabaseProblem(vercelEnv: string | undefined, urls: (string | undefined)[]): string | null {
  if (!vercelEnv || vercelEnv === "production") return null;
  if (!urls.some((u) => u?.toLowerCase().includes(PRODUCTION_DB_REF))) return null;
  return `Refusing to connect: this ${vercelEnv} deployment's database URL points at the PRODUCTION project. Use the separate staging database (docs/STAGING.md).`;
}
