import Link from "next/link";
import type { Locale } from "@/lib/i18n";
import Nav from "@/components/ui/Nav";
import PageHead from "@/components/ui/PageHead";
import Incoming from "@/components/ui/Incoming";
import { CONTACT, FACT, INTERNSHIP, WORK_PLAN, fmt, weeks } from "@/lib/facts";

/** The project as the owner set it up: the direction, the two student tracks, the plan and what counts as success. */
export default async function Project({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: l } = await params;
  const locale = l as Locale;
  const no = locale === "no";
  const principles = no
    ? ["Knotten skal vise hvordan fremtidens boliger kan planlegges tidlig, med energi, teknologi og trygghet som premiss.", "Eksisterende bolighus og kontorbygg, og det planlagte lager- og verkstedbygget, vurderes som en del av det samlede energibildet for området.", "Arbeidet brukes videre i regulering, konseptutvikling, nettside, investorarbeid og dialog med kommune og samarbeidspartnere."]
    : ["Knotten shall show how tomorrow's homes can be planned early, with energy, technology and safety as the premise.", "The existing house and office building, and the planned warehouse and workshop, are assessed as part of the area's whole energy picture.", "The work feeds into zoning, concept development, the website, investor work and dialogue with the municipality and partners."];
  const track1: [string, string, string][] = no
    ? [["Energibehov for nye boliger", "Forventet forbruk, boligtyper, standardnivå, oppvarming, varmtvann og elbillading. Hva krever TEK17, passivhus eller plusshus?", "Notat med energibudsjett og antakelser"], ["Lokal energiproduksjon", "Solceller på tak og fasader, solfangere, småskala vind, energibrønner og grunnvarme. Hva passer tomt, klima, økonomi og drift?", "Oversikt over teknologier med fordeler og ulemper"], ["Energilagring og styring", "Batterier, termisk lagring, sandbatteri, smart styring, bil som lager og laststyring. Hvordan lagres energi til når behovet er størst?", "Skisse til lagrings- og styringskonsept"], ["Eksisterende bygg som tillegg", `Bolighus, kontorbygg med inntil ${FACT.offices_after} kontorer og lager- og verkstedbygg som energibrukere og mulige energiflater.`, "Tilleggsnotat om eksisterende bygg"], ["Robusthet og beredskap", "Drift ved strømbrudd, kritiske laster, nødstrøm, batterikapasitet og prioritering. Hva må fungere, og hvor lenge?", "Beredskaps- og robusthetsvurdering"], ["Anbefalt konsept", "Alternativene sammenlignes og en realistisk løsning foreslås for første byggetrinn og videre utbygging.", "Teknisk sluttrapport og anbefaling"]]
    : [["Energy demand for new homes", "Expected consumption, house types, standard, heating, hot water and car charging. What do TEK17, passive house or plus house require?", "Note with energy budget and assumptions"], ["Local energy production", "Solar on roofs and facades, solar collectors, small wind, boreholes and ground heat. What suits the site, climate, economy and operation?", "Overview of technologies with pros and cons"], ["Storage and control", "Batteries, thermal storage, sand battery, smart control, the car as storage and load management. How is energy stored for when demand peaks?", "Sketch of a storage and control concept"], ["Existing buildings as an addition", `The house, the office with up to ${FACT.offices_after} offices and the workshop as energy users and possible energy surfaces.`, "Supplementary note on existing buildings"], ["Resilience and preparedness", "Operation in an outage, critical loads, backup power, battery capacity and priorities. What must work, and for how long?", "Preparedness and resilience assessment"], ["Recommended concept", "Alternatives compared and a realistic solution proposed for the first stage and further build-out.", "Technical final report and recommendation"]];
  const track2: [string, string, string][] = no
    ? [["Målgrupper", "Boligkjøpere, familier, seniorer, pendlere, miljøbevisste og teknologiinteresserte. Hvem har størst betalingsvilje for energieffektive boliger?", "Målgruppeanalyse og personas"], ["Investor- og partneranalyse", "Investorer, eiendomsaktører, energiselskaper, teknologiaktører, Enova og Innovasjon Norge. Hvem vil støtte, finansiere eller teste?", "Investor- og partnerskapsnotat"], ["Salgsbudskap", "Korte, tydelige budskap for kunder, kommune, investorer og partnere, uten at det blir for teknisk.", "Budskapsbank til nettside og presentasjoner"], ["Konkurrent- og referanseanalyse", "Knotten mot andre energi- og bærekraftsprosjekter i Norge og internasjonalt. Hva gjør Knotten unikt?", "Referanseoversikt og posisjonering"], ["Visuell profil og innhold", "Språk, bildebruk, visualisering, historiefortelling, sosiale medier og prospektstruktur.", "Profil- og innholdsnotat"], ["Eksisterende bygg i historien", "Kontorbygget og verkstedet gir prosjektet et mer komplett energimiljø, presentert som et tillegg.", "Tekst til nettsiden om eksisterende bygg"]]
    : [["Target groups", "Home buyers, families, seniors, commuters, the environmentally aware and the technology-minded. Who will pay most for energy-efficient homes?", "Target group analysis and personas"], ["Investor and partner analysis", "Investors, property players, energy companies, technology players, Enova and Innovation Norway. Who wants to support, finance or test?", "Investor and partnership note"], ["Sales messages", "Short, clear messages for customers, municipality, investors and partners, without getting too technical.", "Message bank for website and presentations"], ["Competitor and reference analysis", "Knotten against other energy and sustainability projects in Norway and abroad. What makes Knotten unique?", "Reference overview and positioning"], ["Visual profile and content", "Language, imagery, visualisation, storytelling, social media and prospectus structure.", "Profile and content note"], ["Existing buildings in the story", "The office and the workshop give the project a more complete energy environment, presented as an addition.", "Website text on existing buildings"]];
  // names and weeks come from the shared work plan; the descriptions are Moderne's own
  const phaseText = no
    ? ["Avklare data, målgrupper og nettsidestruktur. Felles dokumentbank.", "Sol, terreng, bygg og mulige energiflater. Bilder, video og notater.", "Energibehov, produksjon, lagring og eksisterende bygg. Målgrupper, investorer, referanser og budskap. Første innhold publiseres.", "Alternative energikonsepter. Markeds- og investorvinkling. Teknikk og marked kobles inn i nettsiden.", "Antakelser og anbefalinger kontrolleres. Budskap spisses. Nettside, dokumentbank og visualisering forbedres.", "Teknisk energirapport, markeds- og investorrapport, og plattformen med alt innholdet."]
    : ["Clarify data, target groups and site structure. Shared document bank.", "Sun, terrain, buildings and possible energy surfaces. Photos, video and notes.", "Energy demand, production, storage and existing buildings. Target groups, investors, references and messages. First content published.", "Alternative energy concepts. Market and investor angle. Technology and market wired into the website.", "Assumptions and recommendations checked. Messages sharpened. Website, document bank and visualisation improved.", "Technical energy report, market and investor report, and the platform with all the content."];
  const phases: [string, string, string][] = WORK_PLAN.map((p, i) => [p.name[locale], weeks(p.weeks, locale), phaseText[i]]);
  const success = no
    ? ["Antall interesseregistreringer", "Konverteringsmål fra interesse til reservasjon", "Skapt investorinteresse", "Engasjement på nettsiden", "Deltakelse fra kommune, partnere og UiA"]
    : ["Number of interest registrations", "Conversion targets from interest to reservation", "Investor interest generated", "Engagement on the website", "Participation from municipality, partners and UiA"];

  return (
    <>
      <Nav locale={locale} />
      <PageHead
        title={no ? "Prosjektet" : "The project"}
        lede={no
          ? "Sigve Simonsen AS utvikler et eget eid byggefelt på Knotten i Rødberg. Målet er et attraktivt, robust og fremtidsrettet boligfelt med lavt energibehov, lokal energiproduksjon, energilagring og gode løsninger for trygghet og beredskap. Prosjektet starter før reguleringsplanen, slik at teknikk og marked utvikles sammen."
          : "Sigve Simonsen AS is developing a self-owned building field on Knotten at Rødberg. The goal is an attractive, robust and forward-looking housing field with low energy demand, local energy production, energy storage and good solutions for safety and preparedness. The project starts before the zoning plan, so technology and market are developed together."}
      />

      <section className="wrap pb-16 grid gap-4 md:grid-cols-3">
        {principles.map((p, i) => (
          <div key={i} className="panel p-6 rise" style={{ animationDelay: `${i * 60}ms` }}>
            <div className="w-2.5 h-2.5 rounded-full bg-amber mb-4" />
            <p className="text-[15.5px] text-bone-2">{p}</p>
          </div>
        ))}
      </section>

      <section className="wrap section-tight">
        <div className="grid gap-4 md:grid-cols-[1fr_1fr] items-end mb-8">
          <h2 className="display text-[clamp(34px,4.6vw,64px)] max-w-[12ch] rise">{no ? "Tre spor, ett felt." : "Three tracks, one field."}</h2>
          <p className="lede max-w-[46ch] md:justify-self-end rise rise-late">
            {no
              ? `Studenter fra Universitetet i Agder arbeider i to spor, med oppstart ${INTERNSHIP.start.no}, med prosjekteier som mentor. Det tredje sporet, den digitale plattformen, samler arbeidet.`
              : `Students from the University of Agder work in two tracks, starting ${INTERNSHIP.start.en}, with the project owner as mentor. The third track, the digital platform, brings the work together.`}
          </p>
        </div>
        <div className="grid gap-6 lg:grid-cols-2">
          {[[no ? "Spor 1: energi, teknikk og infrastruktur" : "Track 1: energy, technology and infrastructure", track1], [no ? "Spor 2: profilering, marked og visualisering" : "Track 2: profile, market and visualisation", track2]].map(([h, rows]) => (
            <div key={h as string} className="panel p-6 md:p-8">
              <h3 className="display text-[26px]">{h as string}</h3>
              <div className="mt-5 grid gap-4">
                {(rows as [string, string, string][]).map(([t, what, out]) => (
                  <div key={t} className="grid gap-1 py-3 border-t line">
                    <div className="font-medium">{t}</div>
                    <p className="text-[14.5px] text-bone-2">{what}</p>
                    <div className="provenance">{no ? "Leveranse: " : "Deliverable: "}{out}</div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="wrap section-tight grid gap-10 lg:grid-cols-[1fr_1fr]">
        <div>
          <h2 className="display text-[clamp(30px,4vw,48px)]">{no ? "Planen gjennom høsten" : "The plan through the autumn"}</h2>
          <ol className="mt-6 grid gap-3">
            {phases.map(([h, when, p], i) => (
              <li key={h} className="grid grid-cols-[36px_1fr] gap-3 py-3 border-t line">
                <div className="num text-[24px] text-muted">{i + 1}</div>
                <div>
                  <div className="font-medium">{h} <span className="text-muted font-normal">{when}</span></div>
                  <p className="text-[14.5px] text-bone-2 mt-1">{p}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
        <div>
          <h2 className="display text-[clamp(30px,4vw,48px)]">{no ? "Hva som teller som suksess" : "What counts as success"}</h2>
          <p className="mt-4 text-[15.5px] text-bone-2 max-w-[50ch]">{no ? "Prosjekteier ba om forretningsmål ved siden av de tekniske. Antall interesseregistreringer vises i portalen." : "The project owner asked for business goals beside the technical ones. The number of registrations is shown in the portal."}</p>
          <ul className="mt-5 grid gap-2">
            {success.map((s) => <li key={s} className="grid grid-cols-[10px_1fr] gap-3 text-[15px]"><span className="w-1.5 h-1.5 rounded-full bg-amber mt-2.5" />{s}</li>)}
          </ul>
          <div className="mt-8 flex flex-wrap gap-2">
            <Link className="btn btn-ghost" href={`/${locale}/dokumenter`}>{no ? "Arbeidsopplegget og dokumentene" : "The work structure and the documents"}</Link>
            <Link className="btn btn-ghost" href={`/${locale}/portal`}>{no ? "Portalen" : "The portal"}</Link>
          </div>
        </div>
      </section>

      <section className="wrap section-tight">
        <div className="panel p-7 md:p-12 grid gap-12 lg:grid-cols-2 items-center">
          <div>
            <h2 className="display text-[clamp(32px,4.5vw,56px)] max-w-[16ch]">{no ? "Praksis med studenter fra Universitetet i Agder" : "Internship with University of Agder students"}</h2>
            <p className="lede mt-5 max-w-[52ch]">
              {no
                ? `Studenter i praksis gjennom et internship på ${INTERNSHIP.hours} timer, med oppstart ${INTERNSHIP.start.no}. Spor 1: helhetlig energikonsept, energihub og distribusjon, føringer i reguleringsplan, beredskap. Spor 2: profilering, foto og drone, prospekt, digital tilstedeværelse, måling av interesse.`
                : `Students on a ${INTERNSHIP.hours}-hour internship, starting ${INTERNSHIP.start.en}. Track 1: holistic energy concept, hub and distribution, zoning guidance, resilience. Track 2: profiling, photo and drone, prospectus, digital presence, interest measurement.`}
            </p>
            <p className="mt-5 text-muted text-[15px]">{`${no ? "Kontakt" : "Contact"}: ${CONTACT.name}, ${no ? CONTACT.role.no.toLowerCase() : CONTACT.role.en}. ${CONTACT.email}, ${CONTACT.phone_intl}.`}</p>
          </div>
          <Incoming file="site_plan_sketch.webp" alt={no ? "Planskisse" : "Plan sketch"} caption={no ? `Prosjekteiers skisse av vei og tomter på eiendommen gnr ${FACT.gnr} bnr ${FACT.bnr} og ${FACT.bnr_extra}, ${fmt(FACT.parcel_m2)} m².` : `The project owner's sketch of road and plots on the parcel ${FACT.gnr}/${FACT.bnr} and ${FACT.gnr}/${FACT.bnr_extra}, ${fmt(FACT.parcel_m2, "en")} m².`} />
        </div>
      </section>
    </>
  );
}
