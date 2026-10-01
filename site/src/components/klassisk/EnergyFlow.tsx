import { FACT } from "@/lib/facts";

/** System sketch of the owner's preliminary energy direction. Dashes flow along the wires. */
export default function EnergyFlow() {
  return (
    <div className="sysd">
      <svg viewBox="0 0 990 360" role="img" aria-label="Systemskisse: sol og mulig vind lader batterier i hver bolig og et felles lager, som forsyner boliger, kontor og lager, med utveksling mot strømnettet">
        <defs>
          <marker id="arr" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0 0L10 5 0 10z" fill="#4A5A6E" /></marker>
        </defs>
        <g fontSize="12" fill="#14263D">
          <circle cx="120" cy="80" r="26" fill="#F7E7C6" /><circle cx="120" cy="80" r="12" fill="#E3A33B" />
          <text x="120" y="126" textAnchor="middle" fontWeight="600">Sol</text>
          <text x="120" y="142" textAnchor="middle" fontSize="10" fill="#4A5A6E">tak på boligene + felles anlegg</text>
          <g transform="translate(120 240)"><path d="M0 26V-2M0 -2l-14-20M0 -2l14-20" stroke="#7C8A9B" strokeWidth="2" fill="none" strokeDasharray="3 3" /><circle r="4" fill="#7C8A9B" /></g>
          <text x="120" y="292" textAnchor="middle" fontWeight="600" fill="#4A5A6E">Vind</text>
          <text x="120" y="308" textAnchor="middle" fontSize="10" fill="#7C8A9B">vurderes, krever lokale målinger</text>
          <rect x="300" y="52" width="150" height="56" rx="8" fill="#EDF1F5" stroke="#D4DCE4" />
          <text x="375" y="76" textAnchor="middle" fontWeight="600">Batteri i hver bolig</text><text x="375" y="94" textAnchor="middle" fontSize="10" fill="#4A5A6E">med lokal energistyring</text>
          <rect x="300" y="212" width="150" height="56" rx="8" fill="#EDF1F5" stroke="#D4DCE4" />
          <text x="375" y="236" textAnchor="middle" fontWeight="600">Felles lager</text><text x="375" y="254" textAnchor="middle" fontSize="10" fill="#4A5A6E">vurderes for hele feltet</text>
          <rect x="300" y="290" width="150" height="40" rx="8" fill="none" stroke="#7C8A9B" strokeDasharray="4 3" />
          <text x="375" y="314" textAnchor="middle" fontSize="10" fill="#4A5A6E">Sandbatteri er lagt bort</text>
          <rect x="500" y="132" width="120" height="44" rx="22" fill="#14263D" /><text x="560" y="159" textAnchor="middle" fill="#fff" fontWeight="600">Smart styring</text>
          <g transform="translate(700 40)"><path d="M0 24l16-14 16 14v22H0z" fill="#14263D" /><text x="42" y="34" fontWeight="600">{`${FACT.plots} boliger`}</text><text x="42" y="50" fontSize="10" fill="#4A5A6E">lavt energibehov, enkle tak mot sør</text></g>
          <g transform="translate(700 130)"><rect width="34" height="36" y="8" fill="#7C8A9B" /><text x="42" y="30" fontWeight="600">Kontorbygg</text><text x="42" y="46" fontSize="10" fill="#4A5A6E">{`${FACT.offices_now} kontorer i dag, ${FACT.offices_after} planlagt`}</text></g>
          <g transform="translate(700 210)"><rect width="34" height="26" y="14" fill="none" stroke="#3F6A52" strokeWidth="1.5" strokeDasharray="3 2" /><text x="42" y="30" fontWeight="600">Lager og verksted</text><text x="42" y="46" fontSize="10" fill="#4A5A6E">regnes som én bolig inntil videre</text></g>
          <g transform="translate(700 290)"><path d="M6 40V6M0 12h12M2 20h8" stroke="#4A5A6E" strokeWidth="2" fill="none" /><text x="42" y="26" fontWeight="600">Strømnettet</text><text x="42" y="42" fontSize="10" fill="#4A5A6E">ordinær tilknytning, mikronett utredes</text></g>
          <g stroke="#4A5A6E" strokeWidth="1.5" fill="none" markerEnd="url(#arr)">
            <path className="flow" d="M150 80H296" /><path className="flow" d="M150 86C220 100 240 220 296 236" />
            <path d="M150 250H296" strokeDasharray="4 4" opacity=".6" />
            <path className="flow" d="M454 80H560V128" /><path className="flow" d="M454 240H560V180" />
            <path className="flow" d="M624 154H696" /><path className="flow" d="M600 132C640 90 660 68 696 64" /><path className="flow" d="M600 176C640 210 660 226 696 236" /><path className="flow" d="M600 176C650 250 660 300 696 316" />
          </g>
          <path d="M700 320C620 330 560 330 454 264" stroke="#7C8A9B" strokeWidth="1.2" fill="none" strokeDasharray="3 4" />
          <text x="560" y="343" textAnchor="middle" fontSize="10" fill="#7C8A9B">overskudd selges, underskudd kjøpes</text>
        </g>
      </svg>
    </div>
  );
}
