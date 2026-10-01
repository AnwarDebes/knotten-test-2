"use client";
import { usePathname } from "next/navigation";

const APP = /^\/(no|en)\/(portal|login)(\/|$)/;
const PORTAL = /^\/(no|en)\/portal(\/|$)/;

/**
 * Shows its children on the public pages only: the login screens and the portal are an
 * application, not a brochure. `hideOn="portal"` keeps a part on the login screens too
 * (the design switch, since the login page exists in both designs).
 */
export default function SiteOnly({ children, hideOn = "app" }: { children: React.ReactNode; hideOn?: "app" | "portal" }) {
  const path = usePathname() ?? "/";
  if ((hideOn === "portal" ? PORTAL : APP).test(path)) return null;
  return <>{children}</>;
}
