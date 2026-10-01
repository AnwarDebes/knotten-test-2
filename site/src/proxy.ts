import { NextResponse, type NextRequest } from "next/server";
import { DESIGN_COOKIE } from "@/lib/design";
import { AUTH_COOKIE } from "@/lib/auth-shared";

/**
 * Two small jobs before a page renders.
 * The front door remembers the design: Klassisk lives at /, Moderne at /no, and a visitor who
 * picked Moderne with the switch is sent there when they come back to /. Links to a specific page
 * are left alone, so a shared link always opens the page that was shared.
 * The portal sends visitors without a login cookie straight to the login page, with the way back.
 * This is only a shortcut: every portal page checks the signed session itself.
 */
export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const portal = pathname.match(/^\/(no|en)\/portal(\/|$)/);
  if (portal) {
    if (!request.cookies.get(AUTH_COOKIE)) {
      const url = new URL(`/${portal[1]}/login`, request.url);
      url.searchParams.set("next", `${pathname}${search}`);
      return NextResponse.redirect(url);
    }
    return;
  }
  if (request.cookies.get(DESIGN_COOKIE)?.value === "moderne") {
    return NextResponse.redirect(new URL("/no", request.url));
  }
}

export const config = { matcher: ["/", "/no/portal/:path*", "/en/portal/:path*"] };
