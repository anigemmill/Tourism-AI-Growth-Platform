// Operator-portal features a super admin can enable or disable per business.
// A missing BusinessFeature row means the default below applies.

import type { BrandId } from "@/lib/brand";

export const FEATURES = {
  "portal.dashboard": { label: "My business dashboard", description: "Actions, roadmap, results and shared growth briefs.", default: true },
  "portal.collective": { label: "Growth Collective", description: "Cohort-shared learnings, resources and workshops.", default: true },
  "portal.signals": { label: "Business updates", description: "Operator can submit updates to the programme team.", default: true },
} as const;

export type Feature = keyof typeof FEATURES;
export const ALL_FEATURES = Object.keys(FEATURES) as Feature[];

// Findable clients aren't part of a shared cohort, so the Growth Collective
// (cohort directory, workshops, shared learnings) is off unless a super admin
// turns it on for a business.
const BRAND_DEFAULTS: Partial<Record<BrandId, Partial<Record<Feature, boolean>>>> = {
  findable: { "portal.collective": false },
};

export function featureDefault(feature: Feature, brand: BrandId): boolean {
  return BRAND_DEFAULTS[brand]?.[feature] ?? FEATURES[feature].default;
}

export function isFeature(f: string): f is Feature {
  return Object.prototype.hasOwnProperty.call(FEATURES, f);
}

export function enabledFeatures(rows: readonly { feature: string; enabled: boolean }[], brand: BrandId): Feature[] {
  const overrides = new Map(rows.map((r) => [r.feature, r.enabled]));
  return ALL_FEATURES.filter((f) => overrides.get(f) ?? featureDefault(f, brand));
}
