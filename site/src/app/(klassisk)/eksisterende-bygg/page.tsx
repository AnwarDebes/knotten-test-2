import type { Metadata } from "next";
import PageHead from "@/components/klassisk/PageHead";
import Reveal from "@/components/klassisk/Reveal";
import { Src } from "@/components/klassisk/Source";

export const metadata: Metadata = { title: "Eksisterende bygg" };

function EmptyChart({ title }: { title: string }) {
  return (
    <svg viewBox="0 0 420 150" aria-label={`${title}: måledata er ikke hentet ennå`}>
      <g stroke="#E3E9EF" strokeWidth="1"><path d="M40 20H410M40 55H410M40 90H410M40 125H410" /></g>
      <path className="ghostline" d="M40 110C80 100 100 70 140 78 180 86 200 40 240 52 280 64 300 95 340 88 380 81 395 60 410 58" fill="none" stroke="#C9D3DC" strokeWidth="2" strokeDasharray="4 5" />
      <g fontSize="9" fill="#7C8A9B"><text x="40" y="142">jan</text><text x="220" y="142">jul</text><text x="396" y="142">des</text><text x="4" y="24">kWh</text></g>
      <rect x="150" y="40" width="130" height="34" rx="6" fill="#fff" stroke="#D4DCE4" />
      <text x="215" y="61" textAnchor="middle" fontSize="10" fill="#4A5A6E" fontWeight="600">Måledata ikke hentet ennå</text>
    </svg>
  );
}

export default function Bygg() {
  return (
    <>
      <PageHead title="Eksisterende bygg" crumb="Eksisterende bygg">
        <p>Området har allerede et bolighus og et kontorbygg, og et lager- og verkstedbygg er planlagt. De tas inn i energibildet for hele feltet og gir virkelige forbrukstall å måle konseptet mot. <Src id="bygg" /></p>
      </PageHead>
      <section className="sec">
        <div className="wrap">
          <Reveal className="blist" stagger>
            <article><span className="st">I drift</span><h3>Kontorbygget</h3><p>19 kontorer er ferdig i dag. Bygget utvides til 28 kontorer. Faktisk strømforbruk for dagens bygg hentes inn, regnes om per kontor og skaleres til 28, med felleslaster som oppvarming og ventilasjon holdt for seg. <Src id="kontor" /></p></article>
            <article><span className="st">I drift</span><h3>Bolighuset</h3><p>Ligger nederst i feltet og tas inn i det samlede energibildet for området som en energibruker og mulig energiflate.</p></article>
            <article><span className="st">Planlagt</span><h3>Lager og verksted</h3><p>Bygges rett bak bolighuset. Til målte tall finnes, dimensjoneres bygget som én bolig. Det er en tydelig merket antakelse som byttes ut med målerdata. <Src id="lager" /></p></article>
          </Reveal>

          <Reveal className="meter" delay={100}>
            <div>
              <span className="tag blue">Kommer</span>
              <h3>Strømforbruk, kontorbygget</h3>
              <p className="small" style={{ marginTop: 8 }}>Historisk forbruk vises her når målingene er hentet inn. Så kan vi sammenligne før og etter utvidelsen, og vise faktisk ytelse i stedet for løfter.</p>
            </div>
            <EmptyChart title="Kontorbygget" />
          </Reveal>
          <Reveal className="meter" delay={160}>
            <div>
              <span className="tag blue">Kommer</span>
              <h3>Strømforbruk, bolighuset</h3>
              <p className="small" style={{ marginTop: 8 }}>Et vanlig hus i dag, målt time for time. Referansen for hva de nye boligene skal slå.</p>
            </div>
            <EmptyChart title="Bolighuset" />
          </Reveal>
          <p className="small" style={{ marginTop: 20, maxWidth: "70ch" }}>Målingene leses fra strømmålernes HAN-port eller hentes fra Elhub. Nettsiden viser data, den styrer ingenting i byggene.</p>
        </div>
      </section>
    </>
  );
}
