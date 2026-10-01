import type { Metadata } from "next";
import Link from "next/link";
import PageHead from "@/components/klassisk/PageHead";
import Reveal from "@/components/klassisk/Reveal";
import { DOCS, EED, dateNo, type Access } from "@/lib/facts";

export const metadata: Metadata = { title: "Dokumentbank" };

type Doc = { t: string; m: string; date: string; type: string; access: "Offentlig" | "Innlogging"; href?: string };

/** Date, access and file come from the shared document register; title and description are Klassisk's own. */
const doc = (id: keyof typeof DOCS, t: string, m: string, type: string, href?: string): Doc => {
  const d: { date: string; access: Access; file?: string } = DOCS[id];
  return { t, m, type, date: dateNo(d.date), access: d.access === "login" ? "Innlogging" : "Offentlig", href: href ?? d.file };
};

const GROUPS: { name: string; docs: Doc[] }[] = [
  {
    name: "Prosjekteier",
    docs: [
      doc("direction", "Foreløpig retning for energikonseptet", "Svar på spørsmål fra energisporet, norsk og engelsk", "PDF"),
      doc("work", "Arbeidsopplegg for spor 1 og 2", "Roller, arbeidspakker, faser og sluttleveranser", "PDF"),
      doc("view_photos", "Utsikt fra Knotten byggefelt", "Fire bilder av utsikten mot fjorden og havet", "PDF"),
      doc("maps", "Kart og terrengprofil", "Eiendomskart, markert prosjektområde, siktlinje og terrengprofil fra Norgeskart", "PNG", "/kart"),
    ],
  },
  {
    name: "Energisporet",
    docs: [
      doc("status", "Statusoppsummering, elektro og teknikk", "Metode, foreløpige tall og hva som mangler", "PDF"),
      doc("budget", "Energiregnskap, arbeidsversjon", "Forutsetninger, produksjon, lagring og nøkkeltall for året", "XLSX"),
      doc("measures", "Sammenligning av tiltak", "Kostnad, robusthet, energi og anbefaling per tiltak", "PDF"),
      doc("eed", "Grunnvarmeanalyse i Earth Energy Designer", `Grunnlast, brønnkonfigurasjon og væsketemperaturer over ${EED.years} år`, "PNG"),
    ],
  },
  {
    name: "Markedssporet",
    docs: [doc("market", "Marked, merkevare og kommersialisering", "Målgrupper, posisjonering, støtteordninger og plan", "PDF")],
  },
  {
    name: "Nettsiden",
    docs: [{ t: "Kilder og forutsetninger", m: "Én rad per tall: verdi, enhet, kilde, dato, ansvarlig og usikkerhet", date: "løpende", type: "WEB", access: "Offentlig", href: "/kilder" }],
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
                  <Link key={d.t} className="doc" href={d.access === "Innlogging" ? "/logg-inn" : d.href ?? "#"}>
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
