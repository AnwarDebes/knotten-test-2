import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import PageHead from "@/components/klassisk/PageHead";
import Reveal from "@/components/klassisk/Reveal";
import { Src } from "@/components/klassisk/Source";
import { PHOTOS } from "@/lib/klassisk/photos";

export const metadata: Metadata = { title: "Om prosjektet" };

const GOALS = [
  ["Lavt energibehov", "Boligene planlegges med lavest mulig energibehov fra start, med bygningsutforming, tetthet og varmegjenvinning."],
  ["Lokal energiproduksjon", "Sol på boligene og et felles anlegg bak feltet. Vind vurderes som supplement."],
  ["Energideling og lagring", "Batteri i hver bolig, med mulig tilgang til et felles lager for hele feltet."],
  ["Robusthet ved strømbrudd", "Kritiske laster skal fungere når nettet faller ut. Hvor lenge, avklares i energikonseptet."],
  ["Referanseprosjekt nasjonalt", "Alt dokumenteres, slik at andre felt kan bygge på det Knotten finner ut."],
];

const PHASES = [
  ["Oppstart", "Uke 1", "Avklare data, målgrupper og nettsidestruktur"],
  ["Befaring", "Dato avtales", "Sol, terreng, bygg og energiflater på stedet"],
  ["Research", "Uke 2 til 4", "Energibehov, produksjon, lagring, investorer og referanser"],
  ["Konsept", "Uke 5 til 7", "Alternative energikonsepter og markedsvinkling"],
  ["Kvalitetssikring", "Uke 8 til 10", "Antakelser kontrolleres, budskap spisses"],
  ["Sluttfase", "Uke 11 til 12", "Teknisk rapport, markedsrapport og ferdig nettside"],
];

export default function Prosjektet() {
  const p = PHOTOS.vigeland;
  return (
    <>
      <PageHead title="Om prosjektet" crumb="Om prosjektet">
        <p>Knotten skal bli Norges mest energivennlige boligfelt. Et nytt boligområde på Rødberg i Lindesnes, regulert med høye ambisjoner, der tekniske løsninger, infrastruktur, regulering og marked utvikles i sammenheng fra start. <Src id="regulering" /></p>
      </PageHead>

      <section className="sec">
        <div className="wrap split">
          <Reveal className="stack">
            <div className="eyebrow">Ambisjonen</div>
            <h2>Fem ting feltet skal levere</h2>
            <p className="lede">Prosjektet starter før reguleringsplanen. Det er gjort med vilje, så energisystemet og boligene kan planlegges sammen i stedet for hver for seg.</p>
          </Reveal>
          <Reveal className="goals" stagger>
            {GOALS.map(([t, d]) => (
              <div key={t}><h3>{t}</h3><p>{d}</p></div>
            ))}
          </Reveal>
        </div>
      </section>

      <section className="sec alt">
        <div className="wrap">
          <Reveal className="stack" style={{ maxWidth: "70ch" }}>
            <div className="eyebrow">Slik jobbes det</div>
            <h2>Tre spor, ett felt</h2>
            <p className="lede">Prosjekteier leder arbeidet. Studenter fra Universitetet i Agder arbeider i to fagspor som møtes på nettsiden, gjennom et internship på 300 timer høsten 2026.</p>
          </Reveal>
          <Reveal className="cols3" stagger>
            <div><h3>Energi, teknikk og infrastruktur</h3><p>Energibehov for nye boliger, lokal produksjon, lagring og styring, de eksisterende byggene, robusthet ved strømbrudd, og til slutt et anbefalt konsept.</p></div>
            <div><h3>Profilering, marked og visualisering</h3><p>Målgrupper, investor- og partneranalyse, salgsbudskap, referanseprosjekter, visuell profil og hvordan de eksisterende byggene inngår i historien.</p></div>
            <div><h3>Digital plattform</h3><p>Denne nettsiden: presentasjon, dokumentbank, visualisering, og en tallbase der hvert tall peker på kilden sin.</p></div>
          </Reveal>
        </div>
      </section>

      <section className="sec">
        <div className="wrap split">
          <Reveal className="stack">
            <div className="eyebrow">Fremdrift i høst</div>
            <h2>Fra befaring til masterplan</h2>
            <p className="measure">Arbeidet er lagt opp i seks faser over tolv uker. Sluttleveransene er en teknisk energirapport, en markeds- og investorrapport, nettsiden, en felles presentasjon og en arbeidsversjon av Knotten masterplan.</p>
            <p className="measure small">Befaringen er et arbeidsmøte på stedet: terreng, utsikt, adkomst og solforhold for det nye feltet, deretter bolighuset, kontorbygget med plass til 28 kontorer og lager- og verkstedbygget.</p>
          </Reveal>
          <Reveal className="timeline" stagger>
            {PHASES.map(([t, w, d], n) => (
              <div key={t} className={n === 0 ? "done" : n === 1 ? "now" : ""}>
                <span className="tw">{w}</span>
                <b>{t}</b>
                <span>{d}</span>
              </div>
            ))}
          </Reveal>
        </div>
      </section>

      <section className="sec alt">
        <div className="wrap split rev">
          <Reveal className="photo">
            <Image src={p.src} alt={p.alt} width={p.w} height={p.h} sizes="(max-width: 900px) 100vw, 58vw" quality={85} />
            <span className="small">{p.caption}. Foto: <a href={p.url} target="_blank" rel="noopener noreferrer">{p.credit}</a>, {p.license}</span>
          </Reveal>
          <Reveal className="stack">
            <div className="eyebrow">Lindesnes</div>
            <h2>Sørlandet, ytterst</h2>
            <p className="lede">Vigeland ligger noen få kilometer nord for feltet, der Audna møter E39. Tettstedet har 1 708 innbyggere og var kommunesenter fram til 2020. Fylkesvei 460 går sørover herfra, gjennom Spangereid til Lindesnes fyr. <Src id="vigeland" /></p>
            <div className="cta-row"><Link className="btn ghost" href="/kart">Se kartene</Link><Link className="btn ghost" href="/galleri">Se bildene</Link></div>
          </Reveal>
        </div>
      </section>
    </>
  );
}
