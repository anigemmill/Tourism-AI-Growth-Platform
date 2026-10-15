import "server-only";

import { cache } from "react";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { enabledFeatures, type Feature } from "@/lib/rbac/features";
import { can, requireUser, type AuthUser } from "./session";

/** Features enabled for one business, memoised per request. */
export const featuresFor = cache(async (operatorId: string): Promise<Feature[]> => {
  const rows = await prisma.businessFeature.findMany({ where: { operatorId }, select: { feature: true, enabled: true } });
  return enabledFeatures(rows);
});

/**
 * Signed-in tourism operator with portal access, plus their current
 * business's enabled features. The business id always comes from the
 * session (checked against their memberships), never from the request.
 */
export async function requireOperator(): Promise<{ user: AuthUser & { operatorId: string }; features: Feature[] }> {
  const user = await requireUser();
  if (user.role !== "OPERATOR" || !user.operatorId) redirect("/");
  if (!can(user, "portal.access")) redirect("/no-access");
  return { user: user as AuthUser & { operatorId: string }, features: await featuresFor(user.operatorId) };
}

export async function requireOperatorFeature(feature: Feature) {
  const ctx = await requireOperator();
  if (!ctx.features.includes(feature)) redirect("/portal");
  return ctx;
}
