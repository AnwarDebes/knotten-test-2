import Link from "next/link";
import { Src } from "@/components/klassisk/Source";
import TerrainCut from "@/components/klassisk/TerrainCut";
import PlanPreview from "@/components/klassisk/PlanPreview";
import Hero from "@/components/klassisk/Hero";
import MapJourney from "@/components/klassisk/MapJourney";
import Reveal from "@/components/klassisk/Reveal";
import { FACT, fmt, word } from "@/lib/facts";

export default function Home() {
  return (
    <>
      <Hero />

      <section className="sec" id="stedet" data-journey="stedet">
        <div className="wrap split">
          <Reveal className="stack">
            <div className="eyebrow">Stedet</div>
            <h2>Fra elva og opp på Knotten</h2>
            <p className="lede">
              Feltet ligger på en knaus rett vest for Rødbergsveien, noen få kilometer sørvest for Vigeland. Nederst, mellom veien og elva, er det flatt. Så stiger terrenget bratt, og fra rekkene oppover skråningen går siktlinjen sørover, ut Sniksfjorden og til åpent hav.
            </p>
            <p className="measure">
              {`Audna er ${FACT.audna_km} kilometer lang og renner ut i fjorden ved Snig. Fjorden er om lag ${word(FACT.fjord_km)} kilometer lang, og bak den ligger havet.`} <Src id="audna" />
            </p>
            <p className="measure small">
              {`Terrengprofilen til høyre er tegnet i Norgeskart fra vannet ved Spangereidveien til Knotten. Lengde ${fmt(FACT.profile_m)} meter, fra 0 til ${FACT.knotten_m} meter over havet.`} <Src id="profil" />
            </p>
          </Reveal>
          <Reveal delay={120}><TerrainCut /></Reveal>
        </div>
      </section>

      <section className="sec alt" id="kart" data-journey="kart">
        <div className="wrap">
          <div className="eyebrow">Fra kysten til tomten</div>
          <h2 style={{ maxWidth: "20ch" }}>Kartene bak planen, ett steg om gangen</h2>
          <p className="lede mt">Prosjekteiers egne kart og et terrengkart laget for nettsiden, fra siktlinjen ut til havet og helt ned til den første skissen av boligrekkene. Bla nedover, så zoomer kartet inn.</p>
          <MapJourney />
        </div>
      </section>

      <section className="sec" id="tomter" data-journey="tomter">
        <div className="wrap split rev">
          <PlanPreview />
          <Reveal className="stack">
            <div className="eyebrow">Tomtene</div>
            <h2>Rekker mot sør, mot sjøen</h2>
            <p className="lede">
              {`Boligene ligger i ${word(FACT.rows)} rekker langs en vei som svinger seg oppover knausen med maks ${FACT.road_grade_pct} prosent stigning. Gangstier binder rekkene sammen. Sørvendte tak bør være så enkle og sammenhengende som mulig, med få oppbygg, slik at de kan fylles med solceller.`} <Src id="tak" />
            </p>
            <p className="measure">
              Kontorbygget og bolighuset nederst finnes allerede. Utvidelsen av kontoret og et lager- og verkstedbygg bak bolighuset er planlagt. <Src id="bygg" />
            </p>
            <div className="cta-row"><Link className="btn" href="/tomtene">Åpne tomtevelgeren</Link></div>
          </Reveal>
        </div>
      </section>

      <section className="sec alt" id="energi" data-journey="energi">
        <div className="wrap">
          <div className="eyebrow">Energi og teknologi</div>
          <h2 style={{ maxWidth: "18ch" }}>Et robust system, ikke én teknologi</h2>
          <p className="lede mt">
            Retningen prosjekteier har satt: sol, mulig vind, batterier i hver bolig og i fellesskap, smart styring og rom for løsninger som kommer senere. Ambisiøst, uten å binde prosjektet til umodne eller unødvendig dyre valg. <Src id="retning" />
          </p>
          <Reveal className="cols3" stagger>
            <div><h3>Batteri i hver bolig</h3><p>Hver bolig bør få eget batteri og lokal energistyring, med mulig tilgang til et felles lager for feltet. Arkitekturen forberedes for energideling uten at det blir en forutsetning i første fase. <Src id="batteri" /></p></div>
            <div><h3>Sol på taket og et felles anlegg</h3><p>Optimaliserte solflater på boligene, kombinert med et felles solanlegg på det høyeste punktet bak feltet. {`Første scenario regner med cirka ${FACT.panels} paneler i fellesanlegget.`} <Src id="paneler" /></p></div>
            <div><h3>Vind som supplement</h3><p>Små vindturbiner vurderes både per bolig og som felles anlegg, for produksjon om kveldene og nettene. Lokale vindmålinger avgjør om det gir reell verdi. <Src id="vind" /></p></div>
          </Reveal>
          <div className="cta-row"><Link className="btn ghost" href="/energi">Se hele energikonseptet</Link></div>
        </div>
      </section>

      <section className="sec" id="bygg" data-journey="bygg">
        <div className="wrap split">
          <Reveal className="stack">
            <div className="eyebrow">Eksisterende bygg</div>
            <h2>Kan måles, ikke bare beregnes</h2>
            <p className="lede">Få nye felt har det Knotten har fra start: bygg som allerede bruker strøm, og som kan måles.</p>
            <div className="cta-row"><Link className="btn ghost" href="/eksisterende-bygg">Om byggene</Link></div>
          </Reveal>
          <Reveal className="stack" delay={120}>
            <p className="measure">{`Kontorbygget har ${FACT.offices_now} kontorer i dag og utvides til ${FACT.offices_after}.`} Bolighuset ligger nederst i feltet. Et lager- og verkstedbygg er planlagt bak det. Strømforbruket deres blir referansen de nye boligene måles mot. <Src id="kontor" /></p>
          </Reveal>
        </div>
      </section>

      <section className="sec alt" id="investor" data-journey="investor">
        <div className="wrap">
          <div className="eyebrow">Investorer og kommune</div>
          <h2 style={{ maxWidth: "20ch" }}>Det som kan dokumenteres, og det som ikke kan det ennå</h2>
          <p className="lede mt">Prosjektet starter før reguleringsplanen. Her er hvor det står, og hva som må på plass før neste steg.</p>
          <Reveal className="phases" stagger>
            <div className="now"><b>Regulering</b><span>Reguleringsplan er ikke vedtatt. Energikonsept og marked utvikles parallelt</span></div>
            <div><b>Energikonsept</b><span>Teknisk rapport og anbefaling fra energisporet</span></div>
            <div><b>Salg gjennom megler</b><span>Tomter, priser og fremdrift oppgis når planen er vedtatt</span></div>
            <div><b>Bygging og måling</b><span>Faktisk ytelse publiseres når boligene står</span></div>
          </Reveal>
          <div className="cta-row"><Link className="btn" href="/investorer">For investorer og kommune</Link></div>
        </div>
      </section>

      <section className="sec" id="kontakt" data-journey="kontakt">
        <div className="wrap band">
          <Reveal className="stack">
            <div className="eyebrow">Meld interesse</div>
            <h2>Vil du følge Knotten?</h2>
            <p className="lede">Boligkjøper, investor, kommune eller forsker. Si fra hvem du er, så tar vi kontakt innen to virkedager.</p>
          </Reveal>
          <div className="cta-row"><Link className="btn" href="/kontakt">Meld interesse</Link><Link className="btn ghost" href="/dokumentbank">Åpne dokumentbanken</Link></div>
        </div>
      </section>
    </>
  );
}
