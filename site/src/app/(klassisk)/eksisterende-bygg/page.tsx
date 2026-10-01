import type { Metadata } from "next";
import PageHead from "@/components/klassisk/PageHead";
import Reveal from "@/components/klassisk/Reveal";
import { Src } from "@/components/klassisk/Source";
import { FACT } from "@/lib/facts";
import { beforeAfter, meters, type Building } from "@/lib/server/records";
import MeterChart from "@/components/klassisk/MeterChart";

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

/** Measured data for a building, or nothing until the owner has loaded it and chosen to publish it. */
function Measured({ b, title, text }: { b?: Building; title: string; text: string }) {
  if (!b || !b.public || b.readings.length === 0) {
    return (
      <>
        <div>
          <span className="tag blue">Kommer</span>
          <h3>{title}</h3>
          <p className="small" style={{ marginTop: 8 }}>{text}</p>
        </div>
        <EmptyChart title={title} />
      </>
    );
  }
  const nf = (v: number) => Math.round(v).toLocaleString("nb-NO");
  const first = b.readings[0].month, last = b.readings[b.readings.length - 1].month;
  return (
    <>
      <div>
        <span className="tag green">Målt</span>
        <h3>{title}</h3>
        <p className="small" style={{ marginTop: 8 }}>{`Målt forbruk per måned fra ${first} til ${last}. Kilde: ${b.source ?? "måleverdier"}.`}</p>
        {b.upgrades.map((u) => {
          const ba = beforeAfter(b.readings, u.date);
          return <p key={u.id} className="small" style={{ marginTop: 8 }}><strong>{u.title}</strong>{` (${u.date})`}{ba ? `: ${ba.change_pct > 0 ? "+" : ""}${ba.change_pct.toFixed(0)} % de ${ba.pairs} månedene etter mot før, ${nf(ba.after)} mot ${nf(ba.before)} kWh. Ikke temperaturkorrigert.` : ": før og etter vises når det finnes målinger på begge sider."}</p>;
        })}
      </div>
      <MeterChart b={b} />
    </>
  );
}

export default async function Bygg() {
  const { buildings } = await meters.read();
  const office = buildings.find((x) => x.id === "office"), house = buildings.find((x) => x.id === "house");
  return (
    <>
      <PageHead title="Eksisterende bygg" crumb="Eksisterende bygg">
        <p>Området har allerede et bolighus og et kontorbygg, og et lager- og verkstedbygg er planlagt. De tas inn i energibildet for hele feltet og gir virkelige forbrukstall å måle konseptet mot. <Src id="bygg" /></p>
      </PageHead>
      <section className="sec">
        <div className="wrap">
          <Reveal className="blist" stagger>
            <article><span className="st">I drift</span><h3>Kontorbygget</h3><p>{`${FACT.offices_now} kontorer er ferdig i dag. Bygget utvides til ${FACT.offices_after} kontorer. Faktisk strømforbruk for dagens bygg hentes inn, regnes om per kontor og skaleres til ${FACT.offices_after}, med felleslaster som oppvarming og ventilasjon holdt for seg.`} <Src id="kontor" /></p></article>
            <article><span className="st">I drift</span><h3>Bolighuset</h3><p>Ligger nederst i feltet og tas inn i det samlede energibildet for området som en energibruker og mulig energiflate.</p></article>
            <article><span className="st">Planlagt</span><h3>Lager og verksted</h3><p>Bygges rett bak bolighuset. Til målte tall finnes, dimensjoneres bygget som én bolig. Det er en tydelig merket antakelse som byttes ut med målerdata. <Src id="lager" /></p></article>
          </Reveal>

          <Reveal className="meter" delay={100}>
            <Measured b={office} title="Strømforbruk, kontorbygget" text="Historisk forbruk vises her når målingene er hentet inn. Så kan vi sammenligne før og etter utvidelsen, og vise faktisk ytelse i stedet for løfter." />
          </Reveal>
          <Reveal className="meter" delay={160}>
            <Measured b={house} title="Strømforbruk, bolighuset" text="Et vanlig hus i dag, målt time for time. Referansen for hva de nye boligene skal slå." />
          </Reveal>
          <p className="small" style={{ marginTop: 20, maxWidth: "70ch" }}>Målingene leses fra strømmålernes HAN-port eller hentes fra Elhub. Nettsiden viser data, den styrer ingenting i byggene.</p>
        </div>
      </section>
    </>
  );
}
