import type { Locale } from "@/lib/i18n";
import { FACT, fmt } from "@/lib/facts";

/**
 * A principle cross-section from open sea to the top of Knotten, not to scale: the sea, the
 * fjord, the flat by the Audna with the office and the house, and the rows up the south face.
 * Drawn in the site's own colours. Static SVG, so it costs nothing.
 */
export default function TerrainCut({ locale }: { locale: Locale }) {
  const no = locale === "no";
  return (
    <figure className="panel p-3 md:p-4">
      <svg viewBox="0 0 760 330" role="img" aria-label={no ? "Snitt gjennom terrenget fra havet til Knotten" : "Cross-section from the sea to Knotten"} className="w-full h-auto block">
        <defs>
          <linearGradient id="tc-sky" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="#f5f8fa" /><stop offset="1" stopColor="#e2edf4" /></linearGradient>
          <linearGradient id="tc-sea" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="#8fbfd8" /><stop offset="1" stopColor="#2f6688" /></linearGradient>
        </defs>
        <rect width="760" height="330" rx="12" fill="url(#tc-sky)" />
        <path d="M0 176c60-20 110-30 170-22 60 8 100 20 140 18 30-1 50-8 80-8V190H0z" fill="#cfe2ee" />
        <rect x="0" y="190" width="420" height="52" fill="url(#tc-sea)" />
        <path d="M0 205h420M0 218h420M0 231h420" stroke="#fff" strokeWidth="1" strokeDasharray="18 30" fill="none" opacity=".6" />
        <path d="M400 242c40-4 80-6 120-6 40 0 80 2 120 4v90H400z" fill="#dce8e0" />
        <path d="M560 240c40-10 70-40 95-80 20-32 45-60 70-70 12-4 25-6 35-6V330H560z" fill="#4f7156" />
        <path d="M560 240c40-10 70-40 95-80 20-32 45-60 70-70 12-4 25-6 35-6" fill="none" stroke="#2f4f38" strokeWidth="1.5" />
        <g fill="#17283a">
          <path d="M600 216l10-9 10 9v10h-20z" /><path d="M628 196l10-9 10 9v10h-20z" /><path d="M652 170l10-9 10 9v10h-20z" /><path d="M676 146l10-9 10 9v10h-20z" /><path d="M700 118l10-9 10 9v10h-20z" /><path d="M724 96l10-9 10 9v10h-20z" />
        </g>
        <g fill="#e2a23b"><rect x="736" y="82" width="6" height="3" /><rect x="744" y="80" width="6" height="3" /><rect x="752" y="78" width="6" height="3" /></g>
        <rect x="470" y="228" width="22" height="12" fill="#6a7b89" /><rect x="510" y="226" width="30" height="14" fill="#6a7b89" />
        <path d="M662 172L40 194" stroke="#2f6688" strokeWidth="1.2" strokeDasharray="4 5" fill="none" />
        <circle cx="40" cy="194" r="3" fill="#2f6688" />
        <path d="M400 300h340" stroke="#6a7b89" strokeWidth="1" /><path d="M400 295v10M740 295v10" stroke="#6a7b89" strokeWidth="1" />
        <g fontSize="11" fill="#17283a" fontFamily="system-ui, sans-serif">
          <text x="14" y="182" fill="#2f6688" fontWeight="600">{no ? "Åpent hav" : "Open sea"}</text>
          <text x="260" y="182">Sniksfjorden</text>
          <text x="404" y="262">{no ? "Audnas utløp" : "The Audna outlet"}</text>
          <text x="466" y="222" fontSize="10" fill="#3a4d60">{no ? "Bolighus og kontor i dag" : "House and office today"}</text>
          <text x="600" y="262" fill="#fff" fontWeight="600">Knotten</text>
          <text x="600" y="278" fill="#dce8e0" fontSize="10">{no ? "Boligrekker mot sør" : "Rows facing south"}</text>
          <text x="640" y="70" fill="#7a5312" fontSize="10">{no ? "Felles solanlegg bak feltet" : "Shared solar behind the field"}</text>
          <text x="404" y="318" fill="#3a4d60" fontSize="10">{no ? `Terrengprofil ${fmt(FACT.profile_m)} m, 0 til ${FACT.knotten_m} moh` : `Terrain profile ${fmt(FACT.profile_m, "en")} m, 0 to ${FACT.knotten_m} m`}</text>
          <text x="80" y="200" fill="#2f6688" fontSize="10" fontStyle="italic">{no ? "siktlinje" : "sight line"}</text>
        </g>
      </svg>
      <figcaption className="provenance mt-2.5 flex flex-wrap justify-between gap-2">
        <span>{no ? "Prinsippsnitt, ikke i målestokk." : "Principle section, not to scale."}</span>
        <span>{no ? "Kartgrunnlag: Kartverket" : "Map basis: Kartverket"}</span>
      </figcaption>
    </figure>
  );
}
