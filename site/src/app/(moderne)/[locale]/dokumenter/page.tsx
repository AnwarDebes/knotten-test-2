import type { Locale } from "@/lib/i18n";
import Nav from "@/components/ui/Nav";
import PageHead from "@/components/ui/PageHead";
import { DOCS, FACT, type Access } from "@/lib/facts";
import { pageMeta } from "@/lib/meta";
import { isLocale } from "@/lib/i18n";
import { notFound } from "next/navigation";

export const generateMetadata = pageMeta("/dokumenter", {
  no: { title: "Dokumenter", description: "Det prosjektet har laget så langt, med dato og hvem som eier det. Rapportene fra energisporet og markedssporet legges her når de leveres." },
  en: { title: "Documents", description: "What the project has produced so far, with date and owner. The reports from the energy and market tracks are added here when delivered." },
});

/** The document bank: what the project has produced so far, with date, owner and format. */
export default async function Documents({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: l } = await params;
  if (!isLocale(l)) notFound();
  const locale = l as Locale;
  const no = locale === "no";
  /** Date, access and file come from the shared document register; title, description and owner are Moderne's own. */
  const doc = (id: keyof typeof DOCS, title: string, what: string, owner: string, type: string) => {
    const d: { date: string; access: Access; file?: string } = DOCS[id];
    const login = d.access === "login";
    return { title, what: login ? `${what} ${no ? "Krever innlogging." : "Login required."}` : what, date: d.date, owner, href: login ? `/${locale}/portal/dokumenter?dok=${id}` : d.file ?? `/${locale}/dokumenter`, type };
  };
  const docs: { title: string; what: string; date: string; owner: string; href: string; type: string }[] = no
    ? [
        doc("work", "Arbeidsopplegg, spor 1 og 2", "Roller, arbeidspakker, milepæler og leveranser for energi, marked og nettside. Norsk og engelsk.", "Prosjekteier", "PDF"),
        doc("direction", "Foreløpig retning for energikonseptet", "Svar på energisporets spørsmål: batteri, mikronett, sandbatteri, kontorbygget, sol og vind. Norsk og engelsk.", "Prosjekteier", "PDF"),
        doc("budget", "Energiregnskap, forutsetninger", "Månedlig energiregnskap for hele feltet med inndata, beregninger og usikkerhet per rad.", "Energisporet", "Excel"),
        doc("budget", "Energiregnskap, forutsetninger (utskrift)", "Samme regneark som PDF.", "Energisporet", "PDF"),
        doc("view_photos", "Utsikt fra Knotten byggefelt", "Fire bilder av utsikten mot fjorden og havet.", "Prosjekteier", "PDF"),
        doc("feedback", "Tilbakemelding på leveranseplanen", "Prosjekteiers vurdering av planen for den digitale plattformen, med seks punkter til neste revisjon.", "Prosjekteier", "PDF"),
        doc("plots_data", "Tomtedata, alle tomter", "Posisjon, terreng, sol, sikt og horisontprofil for hver tomt, beregnet av nettsidens modell for det foreløpige utlegget.", "Plattform", "JSON"),
        doc("road_data", "Veinett med stigning", `Veiene i modellens forslag med stigning per del, målt mot ${FACT.road_grade_pct} %-kravet. Veiene er plassholdere.`, "Plattform", "JSON"),
        doc("parcel_data", "Eiendom fra Matrikkelen", `Eiendomsgrensen for gnr ${FACT.gnr} bnr ${FACT.bnr} og ${FACT.bnr_extra}, lokale koordinater.`, "Plattform, fra Kartverkets data", "JSON"),
      ]
    : [
        doc("work", "Work structure, tracks 1 and 2", "Roles, work packages, milestones and deliverables for energy, market and website. Norwegian and English.", "Project owner", "PDF"),
        doc("direction", "Preliminary direction for the energy concept", "Answers to the energy track's questions: battery, microgrid, sand battery, the office building, solar and wind. Norwegian and English.", "Project owner", "PDF"),
        doc("budget", "Energy budget, assumptions", "Monthly energy budget for the whole field with inputs, calculations and uncertainty per row.", "Energy track", "Excel"),
        doc("budget", "Energy budget, assumptions (print)", "The same spreadsheet as PDF.", "Energy track", "PDF"),
        doc("view_photos", "The view from Knotten", "Four photos of the view towards the fjord and the sea.", "Project owner", "PDF"),
        doc("feedback", "Feedback on the delivery plan", "The project owner's assessment of the plan for the digital platform, with six points for the next revision.", "Project owner", "PDF"),
        doc("plots_data", "Plot data, all plots", "Position, terrain, sun, view and horizon profile for every plot, computed by the website's model for the provisional layout.", "Platform", "JSON"),
        doc("road_data", "Road network with grades", `The roads in the model's proposal with the grade per segment, against the ${FACT.road_grade_pct} % limit. The roads are placeholders.`, "Platform", "JSON"),
        doc("parcel_data", "Parcel from the cadastre", `The parcel boundary for ${FACT.gnr}/${FACT.bnr} and ${FACT.gnr}/${FACT.bnr_extra}, local coordinates.`, "Platform, from Kartverket data", "JSON"),
      ];
  return (
    <>
      <Nav locale={locale} />
      <PageHead
        title={no ? "Dokumenter." : "Documents."}
        lede={no
          ? "Det prosjektet har laget så langt, med dato og hvem som eier det. Rapportene fra energisporet og markedssporet legges her når de leveres. Arbeidsdokumenter krever innlogging."
          : "What the project has produced so far, with date and owner. The reports from the energy and market tracks are added here when delivered. Working documents require a login."}
      />
      <section className="wrap pb-24">
        <div className="grid gap-3">
          {docs.map((doc) => (
            <a key={doc.title} href={doc.href} target="_blank" rel="noreferrer" className="no-underline panel p-5 md:p-6 grid gap-2 md:grid-cols-[1.2fr_2fr_auto] items-center hover:outline hover:outline-2 hover:outline-fjord/40 transition-[outline]">
              <div>
                <div className="display text-[20px] leading-tight">{doc.title}</div>
                <div className="provenance mt-1">{doc.date}, {doc.owner}</div>
              </div>
              <p className="text-[14.5px] text-bone-2">{doc.what}</p>
              <span className="chip justify-self-start md:justify-self-end">{doc.type}</span>
            </a>
          ))}
        </div>
        <p className="provenance mt-6 max-w-[80ch]">{no ? "Dokumentene åpnes i ny fane. Kommer: teknisk energirapport, markeds- og investorrapport, reguleringsgrunnlag." : "Documents open in a new tab. Coming: technical energy report, market and investor report, regulation basis."}</p>
      </section>
    </>
  );
}
