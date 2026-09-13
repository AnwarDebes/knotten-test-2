import Link from "next/link";
import type { Locale } from "@/lib/i18n";
import Nav from "@/components/ui/Nav";
import PageHead from "@/components/ui/PageHead";
import Incoming from "@/components/ui/Incoming";

/** The project as the owner set it up: the direction, the two student tracks, the platform, the plan and what counts as success. */
export default async function Project({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: l } = await params;
  const locale = l as Locale;
  const no = locale === "no";
  const principles = no
    ? ["Knotten skal vise hvordan fremtidens boliger kan planlegges tidlig, med energi, teknologi og trygghet som premiss.", "Eksisterende bolighus, kontorbygg og lager- og verkstedbygg vurderes som en del av det samlede energibildet for området.", "Arbeidet brukes videre i regulering, konseptutvikling, nettside, investorarbeid og dialog med kommune og samarbeidspartnere."]
    : ["Knotten shows how tomorrow's homes can be planned early, with energy, technology and safety as the premise.", "The existing house, office building and workshop are assessed as part of the area's whole energy picture.", "The work feeds into zoning, concept development, the website, investor work and dialogue with the municipality and partners."];
  const track1: [string, string, string][] = no
    ? [["Energibehov for nye boliger", "Forventet forbruk, boligtyper, standardnivå, oppvarming, varmtvann og elbillading. Hva krever TEK17, passivhus eller plusshus?", "Notat med energibudsjett og antakelser"], ["Lokal energiproduksjon", "Solceller på tak og fasader, solfangere, småskala vind, energibrønner og grunnvarme. Hva passer tomt, klima, økonomi og drift?", "Oversikt over teknologier med fordeler og ulemper"], ["Energilagring og styring", "Batterier, termisk lagring, sandbatteri, smart styring, bil som lager og laststyring. Hvordan lagres energi til når behovet er størst?", "Skisse til lagrings- og styringskonsept"], ["Eksisterende bygg som tillegg", "Bolighus, kontorbygg med inntil 28 kontorer og lager- og verkstedbygg som energibrukere og mulige energiflater.", "Tilleggsnotat om eksisterende bygg"], ["Robusthet og beredskap", "Drift ved strømbrudd, kritiske laster, nødstrøm, batterikapasitet og prioritering. Hva må fungere, og hvor lenge?", "Beredskaps- og robusthetsvurdering"], ["Anbefalt konsept", "Alternativene sammenlignes og en realistisk løsning foreslås for første byggetrinn og videre utbygging.", "Teknisk sluttrapport og anbefaling"]]
    : [["Energy demand for new homes", "Expected consumption, house types, standard, heating, hot water and car charging. What do TEK17, passive house or plus house require?", "Note with energy budget and assumptions"], ["Local energy production", "Solar on roofs and facades, solar collectors, small wind, boreholes and ground heat. What suits the site, climate, economy and operation?", "Overview of technologies with pros and cons"], ["Storage and control", "Batteries, thermal storage, sand battery, smart control, the car as storage and load management. How is energy stored for when demand peaks?", "Sketch of a storage and control concept"], ["Existing buildings as an addition", "The house, the office with up to 28 offices and the workshop as energy users and possible energy surfaces.", "Supplementary note on existing buildings"], ["Resilience and preparedness", "Operation in an outage, critical loads, backup power, battery capacity and priorities. What must work, and for how long?", "Preparedness and resilience assessment"], ["Recommended concept", "Alternatives compared and a realistic solution proposed for the first stage and further build-out.", "Technical final report and recommendation"]];
  const track2: [string, string, string][] = no
    ? [["Målgrupper", "Boligkjøpere, familier, seniorer, pendlere, miljøbevisste og teknologiinteresserte. Hvem har størst betalingsvilje for energieffektive boliger?", "Målgruppeanalyse og personas"], ["Investor- og partneranalyse", "Investorer, eiendomsaktører, energiselskaper, teknologiaktører, Enova og Innovasjon Norge. Hvem vil støtte, finansiere eller teste?", "Investor- og partnerskapsnotat"], ["Salgsbudskap", "Korte, tydelige budskap for kunder, kommune, investorer og partnere, uten at det blir for teknisk.", "Budskapsbank til nettside og presentasjoner"], ["Konkurrent- og referanseanalyse", "Knotten mot andre energi- og bærekraftsprosjekter i Norge og internasjonalt. Hva gjør Knotten unikt?", "Referanseoversikt og posisjonering"], ["Visuell profil og innhold", "Språk, bildebruk, visualisering, historiefortelling, sosiale medier og prospektstruktur.", "Profil- og innholdsnotat"], ["Eksisterende bygg i historien", "Kontorbygget og verkstedet gir prosjektet et mer komplett energimiljø, presentert som et tillegg.", "Tekst til nettsiden om eksisterende bygg"]]
    : [["Target groups", "Home buyers, families, seniors, commuters, the environmentally aware and the technology-minded. Who will pay most for energy-efficient homes?", "Target group analysis and personas"], ["Investor and partner analysis", "Investors, property players, energy companies, technology players, Enova and Innovation Norway. Who wants to support, finance or test?", "Investor and partnership note"], ["Sales messages", "Short, clear messages for customers, municipality, investors and partners, without getting too technical.", "Message bank for website and presentations"], ["Competitor and reference analysis", "Knotten against other energy and sustainability projects in Norway and abroad. What makes Knotten unique?", "Reference overview and positioning"], ["Visual profile and content", "Language, imagery, visualisation, storytelling, social media and prospectus structure.", "Profile and content note"], ["Existing buildings in the story", "The office and the workshop give the project a more complete energy environment, presented as an addition.", "Website text on existing buildings"]];
  const phases: [string, string, string][] = no
    ? [["Oppstart", "uke 1", "Avklare data, målgrupper og nettsidestruktur. Felles dokumentbank."], ["Befaring", "avtalt dato", "Sol, terreng, bygg og mulige energiflater. Bilder, video og notater."], ["Research", "uke 2 til 4", "Energibehov, produksjon, lagring og eksisterende bygg. Målgrupper, investorer, referanser og budskap. Første innhold publiseres."], ["Konsept", "uke 5 til 7", "Alternative energikonsepter. Markeds- og investorvinkling. Teknikk og marked kobles inn i nettsiden."], ["Kvalitetssikring", "uke 8 til 10", "Antakelser og anbefalinger kontrolleres. Budskap spisses. Nettside, dokumentbank og visualisering forbedres."], ["Leveranse", "desember 2026", "Teknisk sluttrapport, markeds- og investornotat, og plattformen med alt innholdet."]]
    : [["Start", "week 1", "Clarify data, target groups and site structure. Shared document bank."], ["Site visit", "agreed date", "Sun, terrain, buildings and possible energy surfaces. Photos, video and notes."], ["Research", "weeks 2 to 4", "Energy demand, production, storage and existing buildings. Target groups, investors, references and messages. First content published."], ["Concept", "weeks 5 to 7", "Alternative energy concepts. Market and investor angle. Technology and market wired into the website."], ["Quality assurance", "weeks 8 to 10", "Assumptions and recommendations checked. Messages sharpened. Website, document bank and visualisation improved."], ["Delivery", "December 2026", "Technical final report, market and investor note, and the platform with all the content."]];
  const releases: [string, string][] = no
    ? [["Release 1, nå", "Nettsiden med den målte modellen, tomter med solpass, energikonseptet slik det står, dokumentbank, interesseskjema og portal med roller."], ["Release 2", "Beboerportal, energidashbord bundet til målerne i de eksisterende byggene, datarom for investorer etter NDA, rapportpakker til kommunen."], ["Release 3", "KI-basert optimalisering av energibruk, den levende digitale tvillingen, verktøy for lokal energideling, og integrasjon med smarthussystemer."]]
    : [["Release 1, now", "The website with the measured model, plots with sun passports, the energy concept as it stands, document bank, interest form and a portal with roles."], ["Release 2", "Resident portal, energy dashboard bound to the meters in the existing buildings, investor data room after NDA, report packs for the municipality."], ["Release 3", "AI-based optimisation of energy use, the living digital twin, tools for local energy sharing, and integration with smart-home systems."]];
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
          <h2 className="display text-[clamp(34px,4.6vw,64px)] max-w-[12ch] rise">{no ? "To spor, ett felt." : "Two tracks, one field."}</h2>
          <p className="lede max-w-[46ch] md:justify-self-end rise rise-late">
            {no
              ? "Studenter fra Universitetet i Agder arbeider i to spor fram til desember 2026, med prosjekteier som mentor. Den digitale plattformen samler begge sporene."
              : "Students from the University of Agder work in two tracks until December 2026, with the project owner as mentor. The digital platform gathers both tracks."}
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

      <section className="wrap section-tight">
        <div className="grid gap-4 md:grid-cols-[1fr_1fr] items-end mb-8">
          <h2 className="display text-[clamp(34px,4.6vw,64px)] max-w-[12ch] rise">{no ? "Plattformen, i tre utgaver." : "The platform, in three releases."}</h2>
          <p className="lede max-w-[46ch] md:justify-self-end rise rise-late">
            {no
              ? "Plattformen skal skille Knotten fra andre boligprosjekter: det investorer, kommune og kjøpere ser, er målt, og hvert tall kan spores til sin kilde. Arkitekturen er forberedt på det som kommer."
              : "The platform sets Knotten apart from other developments: what investors, the municipality and buyers see is measured, and every figure traces to its source. The architecture is prepared for what comes next."}
          </p>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {releases.map(([h, p]) => (
            <div key={h} className="panel p-6"><div className="display text-[24px]">{h}</div><p className="mt-3 text-[15px] text-bone-2">{p}</p></div>
          ))}
        </div>
        <p className="mt-6 text-[15px] text-muted max-w-[70ch]">
          {no
            ? "Utover nettsiden kan plattformen bære intern prosjektstyring, dokumentdeling, samarbeid med interessenter, rapportering til kommunen og forskningssamarbeid med UiA. Portalen har rollene bruker, administrator og superadministrator for dette."
            : "Beyond the website, the platform can carry internal project management, document sharing, stakeholder collaboration, municipality reporting and research collaboration with UiA. The portal has the roles user, administrator and super administrator for this."}
        </p>
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
          <p className="mt-4 text-[15.5px] text-bone-2 max-w-[50ch]">{no ? "Prosjekteier ba om forretningsmål ved siden av de tekniske. Disse måles i administratorens oversikt i portalen." : "The project owner asked for business goals beside the technical ones. These are measured in the administrator's overview in the portal."}</p>
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
            <h2 className="display text-[clamp(32px,4.5vw,56px)] max-w-[16ch]">{no ? "Samarbeid med Universitetet i Agder" : "Collaboration with the University of Agder"}</h2>
            <p className="lede mt-5 max-w-[52ch]">
              {no
                ? "Seks til åtte studenter i praksis, 300 timer hver, fra august til desember 2026. Spor 1: helhetlig energikonsept, energihub og distribusjon, føringer i reguleringsplan, beredskap. Spor 2: profilering, foto og drone, prospekt, digital tilstedeværelse, måling av interesse."
                : "Six to eight interns, 300 hours each, from August to December 2026. Track 1: holistic energy concept, hub and distribution, zoning guidance, resilience. Track 2: profiling, photo and drone, prospectus, digital presence, interest measurement."}
            </p>
            <p className="mt-5 text-muted text-[15px]">{no ? "Kontakt: Sigve Simonsen, daglig leder. sigve.simonsen@hotmail.com, +47 954 95 152." : "Contact: Sigve Simonsen, CEO. sigve.simonsen@hotmail.com, +47 954 95 152."}</p>
          </div>
          <Incoming file="site_plan_sketch.webp" alt={no ? "Planskisse" : "Plan sketch"} caption={no ? "Prosjekteiers skisse av vei og tomter på eiendommen gnr 355 bnr 10 og 368, 40 181 m²." : "The project owner's sketch of road and plots on the parcel 355/10 and 355/368, 40,181 m²."} />
        </div>
      </section>
    </>
  );
}
