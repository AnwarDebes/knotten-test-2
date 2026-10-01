"use client";
import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

/**
 * Counts page views for the owner's statistics (src/app/api/collect). No cookies, nothing stored
 * in the browser, nothing about the person: the page, where the visit came from, phone or computer.
 * Browsers that ask not to be tracked (Do Not Track, Global Privacy Control) send nothing.
 */
const SKIP = /^\/((no|en)\/(portal|login)|logg-inn)(\/|$)/;

function send(body: object) {
  try {
    const nav = navigator as Navigator & { globalPrivacyControl?: boolean };
    if (nav.doNotTrack === "1" || nav.globalPrivacyControl) return;
    const data = JSON.stringify(body);
    if (!navigator.sendBeacon?.("/api/collect", new Blob([data], { type: "text/plain" }))) {
      fetch("/api/collect", { method: "POST", body: data, keepalive: true }).catch(() => undefined);
    }
  } catch { /* statistics never get in the way */ }
}

/** A named event without personal data, e.g. that someone started filling in the interest form. */
export function track(event: "form_start") {
  send({ e: event });
}

export default function Track({ design }: { design: "klassisk" | "moderne" }) {
  const path = usePathname();
  const prev = useRef<string | null>(null);
  useEffect(() => {
    if (!path || prev.current === path) return;
    // the first view of a page load carries the real referrer; later in-site navigation comes from the previous page
    const ref = prev.current === null ? document.referrer : `${location.origin}${prev.current}`;
    prev.current = path;
    if (!SKIP.test(path)) send({ p: path, r: ref, w: window.innerWidth, d: design });
  }, [path, design]);
  return null;
}
