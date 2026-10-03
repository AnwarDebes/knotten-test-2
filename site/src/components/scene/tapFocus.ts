"use client";
import { useRef } from "react";

/**
 * Pointer handlers that hand the visitor's input to the 3D model: a mouse or pen press at once, a finger
 * only with a tap. A swipe that starts on the model then still scrolls the page, as a page should; the
 * model takes the finger after the tap, and a tap outside gives it back.
 */
export function useTapFocus(onFocus: () => void) {
  const tap = useRef<{ x: number; y: number; t: number; id: number } | null>(null);
  return (e: React.PointerEvent) => {
    if (e.pointerType !== "touch") {
      if (e.type === "pointerdown") onFocus();
      return;
    }
    if (e.type === "pointerdown") {
      tap.current = { x: e.clientX, y: e.clientY, t: performance.now(), id: e.pointerId };
      return;
    }
    const t = tap.current;
    if (!t || t.id !== e.pointerId) return;
    if (e.type === "pointerup" && Math.hypot(e.clientX - t.x, e.clientY - t.y) < 10 && performance.now() - t.t < 500) onFocus();
    if (e.type === "pointerup" || e.type === "pointercancel") tap.current = null;
  };
}
