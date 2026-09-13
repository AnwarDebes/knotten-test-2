import type { Locale } from "@/lib/i18n";
import Nav from "@/components/ui/Nav";
import PageHead from "@/components/ui/PageHead";

/** The document bank: what the project has produced so far, with date, owner and format. */
export default async function Documents({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: l } = await params;
  const locale = l as Locale;
  const no = locale === "no";
  const docs: { title: string; what: string; date: string; owner: string; href: string; type: string }[] = no
    ? [
        { title: "Arbeidsopplegg, spor 1 og 2", what: "Roller, arbeidspakker, milepæler og leveranser for energi, marked og nettside. Norsk og engelsk.", date: "2026-08", owner: "Prosjekteier", href: "/docs/knotten_arbeidsopplegg_spor_1_og_2.pdf", type: "PDF" },
        { title: "Retning for energikonseptet", what: "Svar på energigruppens spørsmål: batteri, mikronett, sandbatteri, kontorbygget, sol og vind. Norsk og engelsk.", date: "2026-09-04", owner: "Prosjekteier", href: "/docs/knotten_energikonsept_retning_2026-09-04.pdf", type: "PDF" },
        { title: "Energiregnskap, forutsetninger", what: "Månedlig energiregnskap for hele feltet med inndata, beregninger og usikkerhet per rad.", date: "2026-08", owner: "Energigruppen, UiA", href: "/docs/energiregnskap_forutsetninger.xlsx", type: "Excel" },
        { title: "Energiregnskap, forutsetninger (utskrift)", what: "Samme regneark som PDF.", date: "2026-08", owner: "Energigruppen, UiA", href: "/docs/energiregnskap_forutsetninger.pdf", type: "PDF" },
        { title: "Utsikt fra Knotten byggefelt", what: "Fotografiene fra nabotomten: fjorden, elva og åpent hav i det fjerne.", date: "2026-08", owner: "Prosjekteier", href: "/docs/utsikt_fra_knotten_byggefelt.pdf", type: "PDF" },
        { title: "Tilbakemelding på leveranseplan, release 1", what: "Prosjekteiers vurdering av planen for den digitale plattformen, med seks punkter til neste revisjon.", date: "2026-08-28", owner: "Prosjekteier", href: "/docs/tilbakemelding_leveranseplan_release_1.pdf", type: "PDF" },
        { title: "Tomtedata, alle tomter", what: "Posisjon, terreng, sol, sikt og horisontprofil for hver tomt. Det nettsiden leser.", date: "2026-09-13", owner: "Plattform", href: "/data/plots.json", type: "JSON" },
        { title: "Veinett med stigning", what: "Rekkeveier og ramper med stigning per segment mot 6 %-kravet.", date: "2026-09-13", owner: "Plattform", href: "/data/road.json", type: "JSON" },
        { title: "Eiendom fra Matrikkelen", what: "Eiendomsgrensen for gnr 355 bnr 10 og 368, lokale koordinater.", date: "2026-09-08", owner: "Kartverket", href: "/data/parcels.json", type: "JSON" },
      ]
    : [
        { title: "Work structure, tracks 1 and 2", what: "Roles, work packages, milestones and deliverables for energy, market and website. Norwegian and English.", date: "2026-08", owner: "Project owner", href: "/docs/knotten_arbeidsopplegg_spor_1_og_2.pdf", type: "PDF" },
        { title: "Direction for the energy concept", what: "Answers to the energy group's questions: battery, microgrid, sand battery, the office building, solar and wind. Norwegian and English.", date: "2026-09-04", owner: "Project owner", href: "/docs/knotten_energikonsept_retning_2026-09-04.pdf", type: "PDF" },
        { title: "Energy budget, assumptions", what: "Monthly energy budget for the whole field with inputs, calculations and uncertainty per row.", date: "2026-08", owner: "Energy group, UiA", href: "/docs/energiregnskap_forutsetninger.xlsx", type: "Excel" },
        { title: "Energy budget, assumptions (print)", what: "The same spreadsheet as PDF.", date: "2026-08", owner: "Energy group, UiA", href: "/docs/energiregnskap_forutsetninger.pdf", type: "PDF" },
        { title: "The view from Knotten", what: "The photographs from the neighbouring plot: the fjord, the river and open sea in the distance.", date: "2026-08", owner: "Project owner", href: "/docs/utsikt_fra_knotten_byggefelt.pdf", type: "PDF" },
        { title: "Feedback on delivery plan, release 1", what: "The project owner's assessment of the plan for the digital platform, with six points for the next revision.", date: "2026-08-28", owner: "Project owner", href: "/docs/tilbakemelding_leveranseplan_release_1.pdf", type: "PDF" },
        { title: "Plot data, all plots", what: "Position, terrain, sun, view and horizon profile for every plot. What the website reads.", date: "2026-09-13", owner: "Platform", href: "/data/plots.json", type: "JSON" },
        { title: "Road network with grades", what: "Row roads and ramps with grade per segment against the 6 % limit.", date: "2026-09-13", owner: "Platform", href: "/data/road.json", type: "JSON" },
        { title: "Parcel from the cadastre", what: "The parcel boundary for 355/10 and 355/368, local coordinates.", date: "2026-09-08", owner: "Kartverket", href: "/data/parcels.json", type: "JSON" },
      ];
  return (
    <>
      <Nav locale={locale} />
      <PageHead
        title={no ? "Dokumenter." : "Documents."}
        lede={no
          ? "Det prosjektet har laget så langt, med dato og hvem som eier det. Rapportene fra energigruppen og markedsgruppen legges her når de leveres. Investorer får dataromet i portalen."
          : "What the project has produced so far, with date and owner. The reports from the energy and market groups are added here when delivered. Investors get the data room in the portal."}
      />
      <section className="wrap pb-24">
        <div className="grid gap-3">
          {docs.map((doc) => (
            <a key={doc.href} href={doc.href} target="_blank" rel="noreferrer" className="no-underline panel p-5 md:p-6 grid gap-2 md:grid-cols-[1.2fr_2fr_auto] items-center hover:outline hover:outline-2 hover:outline-fjord/40 transition-[outline]">
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
