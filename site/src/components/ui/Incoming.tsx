"use client";
import { useCallback, useState } from "react";

/**
 * An image from /assets/incoming/web that hides itself (and its caption) if the file is missing.
 * The ref check catches files that failed before React attached onError.
 */
export default function Incoming({ file, alt, caption, className = "" }: { file: string; alt: string; caption?: string; className?: string }) {
  const [ok, setOk] = useState(true);
  const check = useCallback((el: HTMLImageElement | null) => {
    if (el && el.complete && el.naturalWidth === 0) setOk(false);
  }, []);
  if (!ok) return null;
  return (
    <figure className={className}>
      <img ref={check} src={`/assets/incoming/web/${file}`} alt={alt} className="w-full h-auto rounded-[var(--radius-lg)]" loading="lazy" onError={() => setOk(false)} />
      {caption && <figcaption className="provenance mt-2.5">{caption}</figcaption>}
    </figure>
  );
}
