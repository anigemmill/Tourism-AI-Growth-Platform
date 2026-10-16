import "server-only";

import { notFound, redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import { featuresFor } from "@/lib/auth/portal";
import { activeEditGrant, clientViewActor, isSupportAdmin, supportBusiness, type SupportAdmin } from "./core";

/**
 * The signed-in Super Admin (validated session, active account). Anyone else
 * is sent away: operators to their own portal, other staff to "no access".
 */
export async function requireSupportAdmin(): Promise<SupportAdmin> {
  const user = await requireUser();
  if (!isSupportAdmin(user)) redirect(user.role === "OPERATOR" ? "/portal" : "/no-access");
  return user;
}

/**
 * Everything a client-view page needs. The business id comes from the URL,
 * so it is checked on every request: the viewer must be a Super Admin and the
 * business must exist. Reads then go through the operator-scoped portal data
 * layer for that one business.
 */
export async function requireClientView(operatorId: string) {
  const admin = await requireSupportAdmin();
  const business = await supportBusiness(operatorId);
  if (!business) notFound();
  const [features, grant] = await Promise.all([featuresFor(business.id), activeEditGrant(admin, business.id)]);
  return { admin, business, actor: clientViewActor(admin, business.id), features, grant };
}
