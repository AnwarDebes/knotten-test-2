/** Sigve Simonsen AS: the low sun over the horizon, the mark used for the company across the Knotten material. */
export default function OwnerLogo({ light = false, size = 26 }: { light?: boolean; size?: number }) {
  return (
    <span className={`owner${light ? " light" : ""}`}>
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M3 17.5c2.2-1.6 3.8-2.4 5.6-2.4 1.6 0 2.6.6 4.2.9 1.9.4 4.2-.1 8.2-2.2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        <path d="M5.5 12.5a6.5 6.5 0 0 1 13 0" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity=".55" />
        <circle cx="12" cy="12.6" r="2.6" fill="#E3A33B" />
      </svg>
      <span>Sigve Simonsen AS</span>
    </span>
  );
}
