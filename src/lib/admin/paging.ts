// Search / filter / pagination helpers for admin tables.

export const PAGE_SIZE = 25;

export type Params = Record<string, string | string[] | undefined>;

export function param(sp: Params, key: string): string {
  const v = sp[key];
  return (typeof v === "string" ? v : "").trim().slice(0, 100);
}

/** `value` if it is one of `allowed`, else undefined (ignores tampered filters). */
export function oneOf<T extends string>(value: string, allowed: readonly T[]): T | undefined {
  return (allowed as readonly string[]).includes(value) ? (value as T) : undefined;
}

export function pageOf(sp: Params): { page: number; skip: number; take: number } {
  const n = Number.parseInt(param(sp, "page"), 10);
  const page = Number.isFinite(n) && n > 0 && n < 10_000 ? n : 1;
  return { page, skip: (page - 1) * PAGE_SIZE, take: PAGE_SIZE };
}

/** Href for the same list with some params changed (empty values dropped). */
export function hrefWith(base: string, sp: Params, changes: Record<string, string | number | undefined>): string {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(sp)) if (typeof v === "string" && v) q.set(k, v);
  for (const [k, v] of Object.entries(changes)) {
    if (v === undefined || v === "") q.delete(k);
    else q.set(k, String(v));
  }
  const s = q.toString();
  return s ? `${base}?${s}` : base;
}
