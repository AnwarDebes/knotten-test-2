import Link from "next/link";
import { pageTitle, portalPage } from "@/lib/server/portal";
import { readStore } from "@/lib/store";
import { loadAuth } from "@/lib/server/accounts";
import { docs, meters, threads, workspace } from "@/lib/server/records";
import { readDays, total } from "@/lib/server/stats";
import { MAIL_ON } from "@/lib/server/mail";
import { INTERNAL_DOCS } from "@/lib/docRegister";
import NoAccess from "@/components/portal/NoAccess";
import { PageHead, Section } from "@/components/portal/ui";

export const dynamic = "force-dynamic";
export const generateMetadata = pageTitle("Funksjoner og status", "Features and status");

type State = "live" | "data" | "placeholder" | "setup";
type Item = { name: string; what: string; state: State; live?: string; href: string };

/**
 * What the platform does today, in the order of the project owner's feedback of 28 August 2026,
 * with the state of each part and live figures from the records. A map for the owner and for
 * whoever takes over the platform.
 */
export default async function Features({ params }: { params: Promise<{ locale: string }> }) {
  const { locale, no, session, ok, base } = await portalPage(params, "/admin/funksjoner", "admin");
  if (!ok) return <NoAccess locale={locale} session={session} area="admin" />;
  const [store, auth, docState, threadState, ws, met, days] = await Promise.all([readStore(), loadAuth(), docs.read(), threads.read(), workspace.read(), meters.read(), readDays(30)]);
  const nf = (v: number) => v.toLocaleString(no ? "nb-NO" : "en-GB");
  const users = auth.accounts.filter((a) => a.role === "user");
  const withArea = (a: string) => users.filter((u) => u.areas.includes(a as never)).length;
  const investorDocs = docState.docs.filter((d) => d.audience.includes("investor") || d.audience.includes("all")).length;
  const promised = INTERNAL_DOCS.filter((r) => docState.docs.some((d) => d.register === r.key)).length;
  const measured = met.buildings.filter((b) => b.readings.length > 0).length;
  const openTasks = ws.tasks.filter((t) => t.status !== "done").length;
  const asks = total(days, "e:ask");
  const visitors = total(days, "uv");
  const targets = Object.keys(store.settings.kpi).length;
  const cron = !!process.env.CRON_SECRET;
  const t = (n: string, e: string) => (no ? n : e);
  /** "1 dokument", "3 dokumenter" (and the English forms). */
  const pl = (n: number, one: [string, string], many: [string, string]) => `${nf(n)} ${n === 1 ? t(...one) : t(...many)}`;

  const groups: { title: string; items: Item[] }[] = [
    {
      title: t("1. Visjonen: det investorer, kommunen og beboere opplever", "1. The vision: what investors, the municipality and residents experience"),
      items: [
        { name: t("Nettsiden i to utseender", "The website in two designs"), what: t("Klassisk og moderne, med 3D-modellen fra Kartverkets laserdata, sol og sikt for hver tomt, energikonseptet og kildene for hvert tall.", "Classic and modern, with the 3D model from Kartverket's laser data, sun and view for every plot, the energy concept and the source of every figure."), state: "live", href: "/" },
        { name: t("Egne rom i portalen", "Rooms of their own in the portal"), what: t("Investorer, kommunen, UiA, prosjektgruppen og beboere ser hvert sitt område, gitt av prosjekteier.", "Investors, the municipality, UiA, the project group and residents each see their own area, given by the project owner."), state: "live", live: pl(users.length, ["bruker invitert", "user invited"], ["brukere invitert", "users invited"]), href: `${base}/admin/brukere` },
        { name: "Knotten AI", what: t("Svarer besøkende fra prosjektets egne data, med lenker til der svaret står.", "Answers visitors from the project's own data, with links to where the answer is shown."), state: "live", live: pl(asks, ["spørsmål siste 30 dager", "question in 30 days"], ["spørsmål siste 30 dager", "questions in 30 days"]), href: `${base}/admin/statistikk` },
      ],
    },
    {
      title: t("2. Videre utvikling", "2. Further development"),
      items: [
        { name: t("Beboerportal", "Resident portal"), what: t("Egen tomt, energi nå, dokumenter for boligen, samtykker og henvendelser.", "Own plot, energy now, documents for the home, consents and requests."), state: withArea("resident") ? "live" : "data", live: pl(withArea("resident"), ["beboer med konto", "resident with an account"], ["beboere med konto", "residents with an account"]), href: `${base}/resident` },
        { name: t("Energidashbord", "Energy dashboard"), what: t("Strømprisen i NO2 og været på tomta direkte, solvarsel, året i balanse. Målinger fra boligene kommer når målerne finnes.", "The NO2 power price and the weather on the plot live, solar forecast, the year in balance. Readings from the homes come when the meters exist."), state: "live", href: `${base}/energy` },
        { name: t("KI-basert optimalisering", "AI-based optimisation"), what: t("Planen for batteri, varmtvann og elbil regnes på ekte priser og værvarsel. Læring av hvert hus sitt forbruk venter på målerdata.", "The plan for battery, hot water and car is computed on real prices and forecasts. Learning each home's use waits for meter data."), state: "live", href: `${base}/energy/optimering` },
        { name: t("Digital tvilling", "Digital twin"), what: t("3D-modellen med energien time for time og en rammekontrakt for levende data.", "The 3D model with the energy hour by hour and a frame contract for live data."), state: "live", href: `${base}/twin` },
        { name: t("Energideling", "Energy sharing"), what: t("Simulator for deling mellom boligene, kontorbygget, felles batteri og fellesanlegg, som årsanslag.", "A simulator for sharing between the homes, the office building, a shared battery and the shared plant, as a yearly estimate."), state: "live", href: `${base}/energy/deling` },
        { name: t("Smarthus-integrasjon", "Smart-home integration"), what: t("Utstyret og grensesnittene er beskrevet; tilkoblingen venter til utstyret er valgt.", "The equipment and its interfaces are described; the connection waits until the equipment is chosen."), state: "placeholder", href: `${base}/energy/smarthjem` },
      ],
    },
    {
      title: t("3. Investorperspektivet", "3. The investor perspective"),
      items: [
        { name: t("Datarommet", "The data room"), what: t("Besparelse, driftskostnader, skalerbarhet, innovasjon og ESG med kilde, scenarioutforsker, dokumenter og spørsmål og svar.", "Saving, running costs, scalability, innovation and ESG with sources, scenario explorer, documents and questions and answers."), state: "live", live: `${pl(investorDocs, ["dokument", "document"], ["dokumenter", "documents"])}, ${pl(threadState.threads.filter((x) => x.area === "investor").length, ["spørsmål", "question"], ["spørsmål", "questions"])}`, href: `${base}/investor` },
      ],
    },
    {
      title: t("4. Eksisterende bygg", "4. Existing buildings"),
      items: [
        { name: t("Historikk, før og etter, målt ytelse", "History, before and after, measured performance"), what: t("Målerdata fra Elhub eller strømleverandøren lastes inn; tiltak registreres og vises før og etter, også på nettsiden når prosjekteier velger det.", "Meter data from Elhub or the supplier is loaded; upgrades are registered and shown before and after, also on the website when the project owner chooses."), state: measured ? "live" : "data", live: t(`${measured} av ${met.buildings.length} bygg har målerdata`, `${measured} of ${met.buildings.length} buildings have meter data`), href: `${base}/energy/eksisterende` },
      ],
    },
    {
      title: t("5. Digitalisering utover nettsiden", "5. Digitalisation beyond the website"),
      items: [
        { name: t("Prosjektstyring", "Project management"), what: t("Oppgaver, beslutningslogg og milepæler; nådde milepæler publiseres som nyhet.", "Tasks, decision log and milestones; reached milestones are published as news."), state: "live", live: pl(openTasks, ["åpen oppgave", "open task"], ["åpne oppgaver", "open tasks"]), href: `${base}/project` },
        { name: t("Dokumentdeling", "Document sharing"), what: t("Opplasting med versjoner og tilgang per område; hver nedlasting logges.", "Uploads with versions and access per area; every download is logged."), state: promised < INTERNAL_DOCS.length ? "data" : "live", live: `${pl(docState.docs.length, ["dokument", "document"], ["dokumenter", "documents"])}, ${t(`${promised} av ${INTERNAL_DOCS.length} fra dokumentbanken lagt inn`, `${promised} of ${INTERNAL_DOCS.length} from the document bank uploaded`)}`, href: `${base}/dokumenter` },
        { name: t("Samarbeid med interessenter", "Stakeholder collaboration"), what: t("Spørsmål, merknader og henvendelser i hvert område, med svar fra prosjektet.", "Questions, remarks and requests in each area, with answers from the project."), state: "live", live: pl(threadState.threads.length, ["tråd", "thread"], ["tråder", "threads"]), href: `${base}` },
        { name: t("Rapportering til kommunen", "Reporting to the municipality"), what: t("Reguleringsgrunnlag som utskrift og kartdata i EPSG:25832. Energirapporten venter på målinger.", "Regulation basis as a printout and map data in EPSG:25832. The energy report waits for readings."), state: "live", href: `${base}/municipality` },
        { name: t("Forskningssamarbeid med UiA", "Research collaboration with UiA"), what: t("Datasettene med lisens og sitering, tellende nedlastinger. Målerserier venter på målere og samtykker.", "The datasets with licence and citation, counted downloads. Meter series wait for meters and consents."), state: "live", href: `${base}/research` },
      ],
    },
    {
      title: t("6. Forretningsmål", "6. Business goals"),
      items: [
        { name: t("Nøkkeltall", "Key figures"), what: t("Registreringer, konvertering, investorinteresse, engasjement, deltakelse og svartid.", "Registrations, conversion, investor interest, engagement, participation and reply time."), state: "live", live: targets ? t(`${targets} mål satt`, `${targets} targets set`) : t("mål settes etter to måneder", "targets set after two months"), href: `${base}/admin` },
        { name: t("Besøksstatistikk uten informasjonskapsler", "Visitor statistics without cookies"), what: t("Besøkende, sider, kilder og skjema, uten sporing av personer.", "Visitors, pages, sources and forms, without tracking people."), state: "live", live: t(`${nf(visitors)} besøkende siste 30 dager`, `${nf(visitors)} visitors in 30 days`), href: `${base}/admin/statistikk` },
        { name: t("Ukentlig sammendrag på e-post", "Weekly summary by email"), what: t("Mandag morgen: nye interessenter, hvem som venter, besøk, henvendelser og frister.", "Monday morning: new leads, who is waiting, visits, questions and deadlines."), state: MAIL_ON && cron ? "live" : "setup", live: !store.settings.weekly_digest ? t("slått av", "switched off") : undefined, href: `${base}/admin/innstillinger` },
      ],
    },
  ];
  const chip: Record<State, [string, string]> = { live: ["chip-pine", t("I drift", "Live")], data: ["chip-amber", t("Venter på data", "Waiting for data")], placeholder: ["", t("Plassholder", "Placeholder")], setup: ["chip-amber", t("Må settes opp", "Needs setting up")] };
  const count = groups.flatMap((g) => g.items);
  return (
    <>
      <PageHead
        eyebrow={no ? "Administrasjon" : "Administration"}
        title={no ? "Funksjoner og status" : "Features and status"}
        lede={no ? "Hva plattformen gjør i dag, ordnet etter prosjekteiers tilbakemelding 28. august 2026, med status og tall rett fra portalen." : "What the platform does today, in the order of the project owner's feedback of 28 August 2026, with status and figures straight from the portal."}
        actions={<span className="text-[14px] text-muted">{count.filter((i) => i.state === "live").length} {no ? "av" : "of"} {count.length} {no ? "i drift" : "live"}</span>}
      />
      {groups.map((g) => (
        <Section key={g.title} title={g.title}>
          <div className="panel divide-y divide-[var(--line)]">
            {g.items.map((i) => (
              <Link key={i.name} href={i.href} className="grid gap-1.5 p-4 md:p-5 no-underline hover:bg-bg/60 transition-colors md:grid-cols-[1fr_auto] md:items-center">
                <span className="min-w-0">
                  <span className="font-medium">{i.name}</span>
                  <span className="block text-[14px] text-ink-2 mt-0.5">{i.what}</span>
                </span>
                <span className="flex flex-wrap items-center gap-2 md:justify-end">
                  {i.live && <span className="text-[13px] text-muted">{i.live}</span>}
                  <span className={`chip ${chip[i.state][0]}`}>{chip[i.state][1]}</span>
                </span>
              </Link>
            ))}
          </div>
        </Section>
      ))}
    </>
  );
}
