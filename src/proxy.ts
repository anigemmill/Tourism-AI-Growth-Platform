// Optimistic auth check only (cookie presence). Real authorisation happens
// server-side in every page, action and route handler — see src/lib/auth.

import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE } from "@/lib/auth/tokens";

export default function proxy(req: NextRequest) {
  const hasSession = Boolean(req.cookies.get(SESSION_COOKIE)?.value);
  if (!hasSession) {
    const url = new URL("/login", req.nextUrl);
    if (req.nextUrl.pathname !== "/") url.searchParams.set("next", req.nextUrl.pathname);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!login|setup|forgot-password|reset-password|invite|verify-email|api|_next/static|_next/image|favicon.ico).*)"],
};
