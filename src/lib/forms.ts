// FormData parsing helpers for server actions. Empty inputs become
// null/undefined rather than "" so optional columns stay genuinely empty.

import { z } from "zod";

export type ActionState =
  | {
      error?: string;
      ok?: string;
      fieldErrors?: Record<string, string[]>;
      /** A single-use link to hand over in person (only when email is not configured). */
      link?: string;
    }
  | undefined;

/**
 * High-impact admin actions must carry an explicit confirmation from the
 * form (a "confirm" checkbox), checked on the server so a stray click or a
 * replayed request without it does nothing.
 */
export function confirmed(fd: FormData): boolean {
  return fd.get("confirm") === "yes";
}

export const NOT_CONFIRMED = { error: "Tick the confirmation box to go ahead." } as const;

const emptyToUndef = (v: unknown) => (typeof v === "string" && v.trim() === "" ? undefined : v);

export const f = {
  str: () => z.string().trim().min(1, "Required"),
  optStr: () => z.preprocess(emptyToUndef, z.string().trim().max(20000).optional()),
  optNum: () => z.preprocess(emptyToUndef, z.coerce.number().finite().optional()),
  int: (min: number, max: number) => z.coerce.number().int().min(min).max(max),
  optInt: (min: number, max: number) => z.preprocess(emptyToUndef, z.coerce.number().int().min(min).max(max).optional()),
  optDate: () => z.preprocess(emptyToUndef, z.coerce.date().optional()),
  date: () => z.coerce.date(),
  bool: () => z.preprocess((v) => v === "on" || v === "true" || v === true, z.boolean()),
  list: () =>
    z.preprocess(
      (v) =>
        typeof v === "string"
          ? v.split(/[,\n]/).map((s) => s.trim()).filter(Boolean)
          : [],
      z.array(z.string().max(200))
    ),
  optId: () => z.preprocess(emptyToUndef, z.string().max(64).optional()),
  url: () => z.preprocess(emptyToUndef, z.url({ error: "Must be a full URL including https://" }).optional()),
  email: () => z.preprocess(emptyToUndef, z.email({ error: "Enter a valid email" }).optional()),
};

/** FormData → plain object (checkbox absent => undefined, handled by f.bool). */
export function formToObject(fd: FormData): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of fd.entries()) {
    if (k.startsWith("$ACTION")) continue;
    out[k] = typeof v === "string" ? v : v;
  }
  return out;
}

export function parseForm<T extends z.ZodTypeAny>(
  schema: T,
  fd: FormData
): { data: z.infer<T>; error?: undefined } | { data?: undefined; error: NonNullable<ActionState> } {
  const res = schema.safeParse(formToObject(fd));
  if (!res.success) {
    const fieldErrors: Record<string, string[]> = {};
    for (const issue of res.error.issues) {
      const key = String(issue.path[0] ?? "form");
      (fieldErrors[key] ??= []).push(issue.message);
    }
    const first = Object.entries(fieldErrors)[0];
    return { error: { error: `Please check the form: ${first[0]} — ${first[1][0]}`, fieldErrors } };
  }
  return { data: res.data };
}

/** Undefined → null for Prisma optional columns. */
export function nullify<T extends Record<string, unknown>>(obj: T): { [K in keyof T]: Exclude<T[K], undefined> | null } {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) out[k] = v === undefined ? null : v;
  return out as { [K in keyof T]: Exclude<T[K], undefined> | null };
}
