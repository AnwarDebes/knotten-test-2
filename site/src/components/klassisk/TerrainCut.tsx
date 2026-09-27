/** Principle cross-section from open sea to Knotten. Not to scale. */
export default function TerrainCut() {
  return (
    <figure className="fig" aria-label="Snitt gjennom terrenget fra havet til Knotten">
      <svg viewBox="0 0 760 330" role="img" aria-labelledby="snittT">
        <title id="snittT">Terrengsnitt: åpent hav, Sniksfjorden, flaten ved Audna og Knotten med boligrekker</title>
        <defs>
          <linearGradient id="sky" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="#F6F8FA" /><stop offset="1" stopColor="#E8EFF5" /></linearGradient>
          <linearGradient id="sea" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="#9CBBD3" /><stop offset="1" stopColor="#5D8DB0" /></linearGradient>
        </defs>
        <rect width="760" height="330" fill="url(#sky)" />
        <path d="M0 176c60-20 110-30 170-22 60 8 100 20 140 18 30-1 50-8 80-8V190H0z" fill="#C9D8E3" />
        <rect x="0" y="190" width="420" height="52" fill="url(#sea)" />
        <path className="shimmer" d="M0 205h420M0 218h420M0 231h420" stroke="#fff" strokeWidth="1" strokeDasharray="18 30" fill="none" />
        <path d="M400 242c40-4 80-6 120-6 40 0 80 2 120 4v90H400z" fill="#DCE8E0" />
        <path d="M560 240c40-10 70-40 95-80 20-32 45-60 70-70 12-4 25-6 35-6V330H560z" fill="#3F6A52" />
        <path d="M560 240c40-10 70-40 95-80 20-32 45-60 70-70 12-4 25-6 35-6" fill="none" stroke="#2C4C3A" strokeWidth="1.5" />
        <g fill="#14263D">
          <path d="M600 216l10-9 10 9v10h-20z" /><path d="M628 196l10-9 10 9v10h-20z" /><path d="M652 170l10-9 10 9v10h-20z" /><path d="M676 146l10-9 10 9v10h-20z" /><path d="M700 118l10-9 10 9v10h-20z" /><path d="M724 96l10-9 10 9v10h-20z" />
        </g>
        <g fill="#E3A33B"><rect x="736" y="82" width="6" height="3" /><rect x="744" y="80" width="6" height="3" /><rect x="752" y="78" width="6" height="3" /></g>
        <rect x="470" y="228" width="22" height="12" fill="#7C8A9B" /><rect x="510" y="226" width="30" height="14" fill="#7C8A9B" />
        <path d="M662 172L40 194" stroke="#2F5F85" strokeWidth="1.2" strokeDasharray="4 5" fill="none" />
        <circle cx="40" cy="194" r="3" fill="#2F5F85" />
        <path d="M400 300h340" stroke="#7C8A9B" strokeWidth="1" /><path d="M400 295v10M740 295v10" stroke="#7C8A9B" strokeWidth="1" />
        <g fontSize="11" fill="#14263D">
          <text x="14" y="182" fill="#2F5F85" fontWeight="600">Åpent hav</text>
          <text x="260" y="182">Sniksfjorden</text>
          <text x="404" y="262">Audna elvas utløp</text>
          <text x="466" y="222" fontSize="10" fill="#4A5A6E">Bolighus og kontor i dag</text>
          <text x="600" y="262" fill="#fff" fontWeight="600">Knotten</text>
          <text x="600" y="278" fill="#DCE8E0" fontSize="10">Boligrekker mot sør</text>
          <text x="640" y="70" fill="#7A5410" fontSize="10">Felles solanlegg bak feltet</text>
          <text x="404" y="318" fill="#4A5A6E" fontSize="10">Terrengprofil 409,5 m, 0 til 60 moh</text>
          <text x="80" y="200" fill="#2F5F85" fontSize="10" fontStyle="italic">siktlinje</text>
        </g>
      </svg>
      <figcaption>
        <span>Prinsippsnitt, ikke i målestokk.</span>
        <span>Kartgrunnlag: Kartverket</span>
      </figcaption>
    </figure>
  );
}
