// Operator-portal features a super admin can enable or disable per business.
// A missing BusinessFeature row means the default below applies.

export const FEATURES = {
  "portal.dashboard": { label: "My business dashboard", description: "Actions, roadmap, results and shared growth briefs.", default: true },
  "portal.collective": { label: "Growth Collective", description: "Cohort-shared learnings, resources and workshops.", default: true },
  "portal.signals": { label: "Business updates", description: "Operator can submit updates to the programme team.", default: true },
} as const;

export type Feature = keyof typeof FEATURES;
export const ALL_FEATURES = Object.keys(FEATURES) as Feature[];

export function isFeature(f: string): f is Feature {
  return Object.prototype.hasOwnProperty.call(FEATURES, f);
}

export function enabledFeatures(rows: readonly { feature: string; enabled: boolean }[]): Feature[] {
  const overrides = new Map(rows.map((r) => [r.feature, r.enabled]));
  return ALL_FEATURES.filter((f) => overrides.get(f) ?? FEATURES[f].default);
}
