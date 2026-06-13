import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Defense-in-depth gate for the admin area (Next 16 renamed `middleware` to
// `proxy`). This is NOT the authorization boundary: each admin route and Server
// Action still enforces the session itself via `requireAdmin()` / the inline
// session check, because Next's docs warn Proxy can be bypassed for Server
// Actions and must not be relied on for auth. All this does is bounce a request
// with no admin session cookie straight to the login page, so a forgotten
// future page can't render its shell before the inline check runs.
//
// We only test for cookie *presence* here (cheap, no crypto). A present-but-
// invalid cookie still passes proxy and is then rejected by the real session
// check downstream.
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // The login page must stay reachable without a session, or we'd loop.
  if (pathname === "/admin/login") {
    return NextResponse.next();
  }

  if (!request.cookies.has("festival_admin")) {
    return NextResponse.redirect(new URL("/admin/login", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: "/admin/:path*",
};
