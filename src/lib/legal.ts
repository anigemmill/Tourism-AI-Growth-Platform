// Legal pages (privacy policy, pilot terms). Text lives in src/content/legal.
// A document is published only when it has no DRAFT marker and no unfilled
// [PLACEHOLDER]; until then its page is a 404 and nothing links to it, so
// merging draft text can never publish it.

import { PRIVACY_POLICY } from "@/content/legal/privacy";
import { PILOT_TERMS } from "@/content/legal/terms";

export type LegalDocId = "privacy" | "terms";

export const LEGAL_DOCS: Record<LegalDocId, { title: string; href: string; body: string }> = {
  privacy: { title: "Privacy policy", href: "/privacy", body: PRIVACY_POLICY },
  terms: { title: "Pilot terms", href: "/terms", body: PILOT_TERMS },
};

const DRAFT = /<!--\s*DRAFT/i;
// "[SOMETHING]" or "[10]" that isn't link text ("[text](url)").
const PLACEHOLDER = /\[[A-Z0-9][^\]\n]*\](?!\()/;

export function isPublishable(body: string): boolean {
  return !DRAFT.test(body) && !PLACEHOLDER.test(body);
}

export function legalDoc(id: LegalDocId) {
  const doc = LEGAL_DOCS[id];
  return isPublishable(doc.body) ? doc : null;
}

/** Published legal documents, for footer links. */
export function publishedLegalDocs() {
  return (Object.keys(LEGAL_DOCS) as LegalDocId[]).map(legalDoc).filter((d): d is NonNullable<typeof d> => d !== null);
}

/**
 * Support address shown to users, from SUPPORT_EMAIL. Unset (or not an
 * address) means no contact link is shown, so an unconfirmed mailbox is never
 * published by accident.
 */
export function supportEmail(env: Record<string, string | undefined> = process.env): string | null {
  const v = env.SUPPORT_EMAIL?.trim();
  return v && /^[^\s@<>()]+@[^\s@<>()]+\.[^\s@<>()]+$/.test(v) ? v : null;
}
