// Pre-flight check for DATABASE_URL / DIRECT_URL, run by vercel-build before
// `prisma migrate deploy`. Prisma's own failure for a malformed URL is a bare
// "P1013: The provided database string is invalid" with no hint of what is
// wrong; this names the problem instead. It never prints the password.

// Returns { errors: string[], warnings: string[], summary: string | null }.
export function checkDatabaseUrl(name, value) {
  const errors = [];
  const warnings = [];
  if (!value) return { errors: [`${name} is not set.`], warnings, summary: null };

  if (value !== value.trim()) {
    errors.push(`${name} has leading or trailing whitespace or a line break — re-paste it without spaces.`);
  }
  const v = value.trim();
  if (/^["']|["']$/.test(v)) {
    errors.push(`${name} is wrapped in quotes — in the Vercel dashboard paste the value without quotes.`);
  }
  if (/^[A-Z_]+=/.test(v)) {
    errors.push(`${name} starts with "${v.split("=")[0]}=" — paste only the value, not the NAME= prefix.`);
  }
  const unquoted = v.replace(/^["']|["']$/g, "");
  if (!/^postgres(ql)?:\/\//.test(unquoted)) {
    errors.push(`${name} must start with postgresql:// (it looks like a ${schemeHint(unquoted)}).`);
    return { errors, warnings, summary: null };
  }

  // Inspect the userinfo before URL parsing: an unencoded # / ? in the
  // password ends the authority early and is what makes the whole URL invalid.
  const authority = unquoted.replace(/^postgres(ql)?:\/\//, "");
  const at = authority.lastIndexOf("@");
  const userinfo = at === -1 ? "" : authority.slice(0, at);
  const rawPassword = userinfo.includes(":") ? userinfo.slice(userinfo.indexOf(":") + 1) : "";
  if (at === -1) {
    errors.push(`${name} has no user:password@ part.`);
  } else {
    const bad = [...new Set(rawPassword.match(/[#/?\s]/g) ?? [])];
    if (bad.length) {
      errors.push(
        `${name}'s password contains unencoded ${bad.map(describeChar).join(", ")} — percent-encode it ` +
          `(e.g. # → %23, / → %2F, ? → %3F, space → %20) or reset the database password to letters and digits only.`,
      );
    }
    // Prisma accepts these (verified against 6.19.3), but they usually mean
    // the password is not what was intended, so warn rather than fail.
    if (/%(?![0-9A-Fa-f]{2})/.test(rawPassword)) {
      warnings.push(`${name}'s password contains a "%" that is not part of a %XX escape — if it is a literal %, encode it as %25.`);
    }
    if (rawPassword.includes("@")) {
      warnings.push(`${name}'s password contains an unencoded "@" — encode it as %40 to be safe.`);
    }
    if (/YOUR[-_]PASSWORD|<password>/i.test(rawPassword)) {
      errors.push(`${name}'s password is still the placeholder — replace it with the real password, without brackets.`);
    } else if (/[[\]]/.test(rawPassword)) {
      warnings.push(`${name}'s password contains [ or ] — if those came from a [YOUR-PASSWORD] template, remove them.`);
    }
  }

  let url;
  try {
    url = new URL(unquoted);
  } catch {
    if (!errors.length) errors.push(`${name} is not a parseable URL (check the host, port and that nothing is cut off).`);
    return { errors, warnings, summary: null };
  }
  if (!url.hostname) errors.push(`${name} has no host.`);
  if (!url.pathname || url.pathname === "/") warnings.push(`${name} has no database name (expected /postgres).`);

  const port = url.port || "5432";
  if (url.hostname.endsWith("pooler.supabase.com")) {
    if (name === "DATABASE_URL" && port === "6543" && url.searchParams.get("pgbouncer") !== "true") {
      warnings.push(`DATABASE_URL uses the transaction pooler (6543) without ?pgbouncer=true.`);
    }
    if (name === "DIRECT_URL" && port === "6543") {
      errors.push(`DIRECT_URL uses the transaction pooler (6543); migrations need the session pooler on port 5432.`);
    }
  }

  const summary =
    `${name}: ${url.protocol}//${decodeSafe(url.username) || "?"}:<${url.password ? "set" : "missing"}>` +
    `@${url.hostname}:${port}${url.pathname}` +
    (url.search ? ` params=${[...url.searchParams.keys()].join(",")}` : "");
  if (!url.password) errors.push(`${name} has no password.`);
  return { errors, warnings, summary };
}

function describeChar(c) {
  return c === " " ? "space" : /\s/.test(c) ? "whitespace" : `"${c}"`;
}

function schemeHint(v) {
  if (/^https?:\/\//.test(v)) return "web URL such as the Supabase project URL, not a Postgres connection string";
  return "value that is not a connection string";
}

function decodeSafe(s) {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
}
