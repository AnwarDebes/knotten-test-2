import type { Metadata } from "next";
import Link from "next/link";
import PageHead from "@/components/klassisk/PageHead";
import Reveal from "@/components/klassisk/Reveal";

export const metadata: Metadata = { title: "Dokumentbank" };

type Doc = { t: string; m: string; date: string; type: string; access: "Offentlig" | "Innlogging" };
const GROUPS: { name: string; docs: Doc[] }[] = [
  {
    name: "Prosjekteier",
    docs: [
      { t: "Foreløpig retning for energikonseptet", m: "Svar på spørsmål fra energisporet, norsk og engelsk", date: "4. sep 2026", type: "PDF", access: "Offentlig" },
      { t: "Arbeidsopplegg for spor 1 og 2", m: "Roller, arbeidspakker, faser og sluttleveranser", date: "sep 2026", type: "PDF", access: "Innlogging" },
      { t: "Utsikt fra Knotten byggefelt", m: "Fire bilder av utsikten mot fjorden og havet", date: "sep 2026", type: "PDF", access: "Offentlig" },
      { t: "Kart og terrengprofil", m: "Eiendomskart, markert prosjektområde, siktlinje og terrengprofil fra Norgeskart", date: "sep 2026", type: "PNG", access: "Offentlig" },
    ],
  },
  {
    name: "Energisporet",
    docs: [
      { t: "Statusoppsummering, elektro og teknikk", m: "Metode, foreløpige tall og hva som mangler", date: "31. aug 2026", type: "PDF", access: "Innlogging" },
      { t: "Energiregnskap, arbeidsversjon", m: "Forutsetninger, produksjon, lagring og nøkkeltall for året", date: "13. sep 2026", type: "XLSX", access: "Innlogging" },
      { t: "Sammenligning av tiltak", m: "Kostnad, robusthet, energi og anbefaling per tiltak", date: "28. aug 2026", type: "PDF", access: "Innlogging" },
      { t: "Grunnvarmeanalyse i Earth Energy Designer", m: "Grunnlast, brønnkonfigurasjon og væsketemperaturer over 35 år", date: "sep 2026", type: "PNG", access: "Innlogging" },
    ],
  },
  {
    name: "Markedssporet",
    docs: [{ t: "Marked, merkevare og kommersialisering", m: "Målgrupper, posisjonering, støtteordninger og plan", date: "27. aug 2026", type: "PDF", access: "Innlogging" }],
  },
  {
    name: "Nettsiden",
    docs: [{ t: "Kilder og forutsetninger", m: "Én rad per tall: verdi, enhet, kilde, dato, ansvarlig og usikkerhet", date: "løpende", type: "WEB", access: "Offentlig" }],
  },
];

export default function Dokumentbank() {
  return (
    <>
      <PageHead title="Dokumentbank" crumb="Dokumentbank" aside={<Link className="btn ghost" href="/logg-inn">Logg inn for interne dokumenter</Link>}>
        <p>Rapporter, kart, bilder og notater samlet på ett sted. Offentlige dokumenter kan lastes ned av alle. Arbeidsdokumenter krever innlogging.</p>
      </PageHead>
      <section className="sec" style={{ paddingTop: 0 }}>
        <div className="wrap">
          <Reveal className="docs">
            {GROUPS.map((g) => (
              <div key={g.name}>
                <div className="grp">{g.name}</div>
                {g.docs.map((d) => (
                  <Link key={d.t} className="doc" href={d.t === "Kilder og forutsetninger" ? "/kilder" : d.access === "Innlogging" ? "/logg-inn" : "#"}>
                    <span className="ic">{d.type}</span>
                    <span><span className="t">{d.t}</span><br /><span className="m">{d.m}</span></span>
                    <span className="m">{d.date}</span>
                    <span className="lock">{d.access}</span>
                  </Link>
                ))}
              </div>
            ))}
          </Reveal>
        </div>
      </section>
    </>
  );
}
