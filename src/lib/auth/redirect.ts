/**
 * Post-login redirect target: a same-site relative path only. Browsers treat
 * "\\" like "/", so "/\\evil.com" would leave the site; control characters
 * are rejected as well.
 */
export function isSafeNext(next: string | undefined | null): next is string {
  return !!next && next.length <= 500 && next.startsWith("/") && !next.startsWith("//") && !/[\\\u0000-\u001f]/.test(next);
}
