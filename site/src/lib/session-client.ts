"use client";
import { useSyncExternalStore } from "react";
import { parseWho, WHO_COOKIE, type Who } from "./auth-shared";

function readCookie(): string {
  try {
    const m = document.cookie.split("; ").find((c) => c.startsWith(WHO_COOKIE + "="));
    return m ? m.slice(WHO_COOKIE.length + 1) : "";
  } catch {
    return "";
  }
}
const subscribe = (cb: () => void) => {
  window.addEventListener("focus", cb);
  return () => window.removeEventListener("focus", cb);
};

/**
 * Who is logged in, for the header's greeting on pages that are otherwise static. It reads the
 * display cookie only; the server checks the real, signed session before showing anything private.
 */
export function useSession(): Who | null {
  const raw = useSyncExternalStore(subscribe, readCookie, () => "");
  return parseWho(raw || undefined);
}
