import Image from "next/image";

/**
 * The logo mark is the round painted vignette from Sigve's logo (it scales cleanly).
 * The wordmark is set as text so it stays sharp at every size.
 */
export default function Logo({ size = 46, light = false }: { size?: number; light?: boolean }) {
  return (
    <span className={`logo${light ? " light" : ""}`}>
      <Image src="/img/logo-mark.png" alt="" width={256} height={256} priority style={{ width: size, height: size }} />
      <span className="logo-text">
        <span className="logo-name">Knotten</span>
        <span className="logo-sub">Sjøutsikt i Rødberg</span>
      </span>
    </span>
  );
}
