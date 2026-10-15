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
