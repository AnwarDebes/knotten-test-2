"use client";
import { useSyncExternalStore } from "react";
import { parseSession, SESSION_COOKIE, type Session } from "./auth-shared";

function readCookie(): string {
  try {
    const m = document.cookie.split("; ").find((c) => c.startsWith(SESSION_COOKIE + "="));
    return m ? m.slice(SESSION_COOKIE.length + 1) : "";
  } catch {
    return "";
  }
}
const subscribe = (cb: () => void) => {
  window.addEventListener("focus", cb);
  return () => window.removeEventListener("focus", cb);
};

/** Reads the preview session from the cookie on the client, so static pages can still show it. */
export function useSession(): Session | null {
  const raw = useSyncExternalStore(subscribe, readCookie, () => "");
  return parseSession(raw || undefined);
}
