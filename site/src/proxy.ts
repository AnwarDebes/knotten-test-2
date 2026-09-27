import { NextResponse, type NextRequest } from "next/server";
import { DESIGN_COOKIE } from "@/lib/design";

/**
 * The front door remembers the design. Klassisk lives at /, Moderne at /no. A visitor who picked
 * Moderne with the switch is sent there when they come back to /. Links to a specific page are
 * left alone, so a shared link always opens the page that was shared.
 */
export function proxy(request: NextRequest) {
  if (request.cookies.get(DESIGN_COOKIE)?.value === "moderne") {
    return NextResponse.redirect(new URL("/no", request.url));
  }
}

export const config = { matcher: "/" };
