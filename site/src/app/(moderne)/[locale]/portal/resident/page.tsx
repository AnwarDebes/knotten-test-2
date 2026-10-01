import { isAdmin } from "@/lib/auth";
import { pageTitle, portalPage } from "@/lib/server/portal";
import { loadPlots } from "@/lib/data";
import { loadProfile, pvForPlot } from "@/lib/energy";
import { canSeeDoc, canSeeThread, docs, residents, threads } from "@/lib/server/records";
import { cloudFactor, current, nowMs, osloDate, osloHourNow, weather } from "@/lib/server/live";
import { saveConsents } from "../actions";
import NoAccess from "@/components/portal/NoAccess";
import Passport from "@/components/ui/Passport";
import { DocList } from "@/components/portal/Docs";
import { Threads } from "@/components/portal/Threads";
import { ActionForm } from "@/components/portal/forms";
import { Notice, PageHead, Section, Stat, Waiting, when } from "@/components/portal/ui";

export const dynamic = "force-dynamic";
export const generateMetadata = pageTitle("Mitt hjem", "My home");

/**
 * The resident portal: one's own plot and home, energy right now, the home's documents, the
 * consents that decide what is shared, and requests to the project. A resident sees only their
 * own home; the field is shown in aggregate elsewhere. Administrators can preview any plot.
 */
export default async function MyHome({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ tomt?: string }> }) {
  const { locale, no, session, ok } = await portalPage(params, "/resident", "resident");
  if (!ok) return <NoAccess locale={locale} session={session} area="resident" />;
  const { tomt } = await searchParams;
  const admin = isAdmin(session);
  const [{ plots }, w, docState, threadState, res] = await Promise.all([loadPlots(), weather(), docs.read(), threads.read(), residents.read()]);
  const plotId = admin && tomt && plots.some((p) => p.id === tomt) ? tomt : session.plot ?? (admin ? plots[6]?.id : undefined);
  const plot = plots.find((p) => p.id === plotId);
  const consents = res.consents[session.id];
  const mine = threadState.threads.filter((t) => t.area === "resident" && canSeeThread(session, t));
  // documents for residents, or for this home in particular; what is shared with everyone is under Documents
  const homeDocs = docState.docs.filter((d) => canSeeDoc(session, d) && (d.audience.includes("resident") || (!!d.plot && d.plot === plotId)) && (!d.plot || d.plot === plotId));
  const wx = current(w);
  const month = Number(osloDate().slice(5, 7));
  const pvNow = plot ? (pvForPlot(plot, new Date(nowMs())) / 0.75) * (wx ? cloudFactor(wx.cloud) : 0.75) : 0;
  const loadNow = loadProfile(osloHourNow(), month);
  const dec = (v: number) => v.toFixed(1).replace(".", no ? "," : ".");

  return (
    <>
      <PageHead
        eyebrow={plot ? `${no ? "Tomt" : "Plot"} ${Number(plot.id.slice(5))}${plot.row_label ? `, ${no ? "rekke" : "row"} ${plot.row_label}` : ""}` : undefined}
        title={no ? "Mitt hjem" : "My home"}
        lede={no ? "Din bolig, din energi og dine dokumenter. Det du deler med feltet og med forskerne, bestemmer du selv under samtykker." : "Your home, your energy and your documents. What you share with the field and with the researchers, you decide yourself under consents."}
        actions={admin ? (
          <form className="flex items-center gap-2">
            <label className="text-[13.5px] text-muted" htmlFor="tomt">{no ? "Vis som beboer på" : "View as the resident of"}</label>
            <select id="tomt" name="tomt" defaultValue={plotId} className="input !py-1.5 !w-auto !text-[14px]">{plots.map((p) => <option key={p.id} value={p.id}>{no ? "Tomt" : "Plot"} {Number(p.id.slice(5))}</option>)}</select>
            <button className="btn btn-sm btn-ghost btn-plain">{no ? "Vis" : "Show"}</button>
          </form>
        ) : undefined}
      />
      {admin && <Notice>{no ? "Du ser siden slik en beboer ser den. Beboere ser bare sin egen tomt, koblet til kontoen under Brukere og tilgang." : "You see the page as a resident sees it. Residents only see their own plot, linked to the account under Users and access."}</Notice>}
      {!plot ? (
        <Waiting no={no} title={no ? "Tomten din er ikke koblet til kontoen ennå" : "Your plot is not linked to your account yet"}>{no ? "Administratoren kobler kontoen til tomten din. Til da kan du se dokumenter og sende henvendelser." : "The administrator links your account to your plot. Until then you can see documents and send requests."}</Waiting>
      ) : (
        <div className="grid gap-5 xl:grid-cols-[1fr_380px] items-start">
          <div className="grid gap-5">
            <div className="grid gap-4 sm:grid-cols-3">
              <Stat label={no ? "Sol på taket nå" : "Solar on the roof now"} value={`${dec(pvNow)} kW`} sub={wx ? (no ? `${Math.round(wx.cloud)} % skydekke nå` : `${Math.round(wx.cloud)} % cloud now`) : undefined} />
              <Stat label={no ? "Forbruk nå" : "Use now"} value={`${dec(loadNow)} kW`} sub={no ? "modellens profil" : "the model's profile"} />
              <Stat label={no ? "Netto nå" : "Net now"} value={`${pvNow >= loadNow ? "+" : ""}${dec(pvNow - loadNow)} kW`} sub={pvNow >= loadNow ? (no ? "overskudd til batteri eller nabo" : "surplus to battery or neighbour") : (no ? "fra batteri eller nett" : "from battery or grid")} tone={pvNow >= loadNow ? "good" : "plain"} />
            </div>
            <Notice>{no ? "Tallene er modellens til boligen har egen måler. Da viser denne siden dine faktiske tall, bare for deg." : "The figures are the model's until the home has its own meter. Then this page shows your actual figures, only to you."}</Notice>
            <Section title={no ? "Dokumenter for boligen" : "Documents for the home"} sub={no ? "Kjøpekontrakt, FDV-dokumentasjon, garantier og bruksanvisning for energisystemet legges her." : "Purchase contract, operation and maintenance documentation, warranties and the energy system manual are added here."}>
              <DocList items={homeDocs} session={session} locale={locale} empty={no ? "Dokumentene kommer når boligen er bygget og overlevert." : "The documents come when the home is built and handed over."} />
            </Section>
          </div>
          <Passport plot={plot} locale={locale} />
        </div>
      )}

      <Section title={no ? "Samtykker" : "Consents"} sub={consents ? (no ? `Sist endret ${when(consents.updated, locale)}.` : `Last changed ${when(consents.updated, locale)}.`) : (no ? "Ikke gitt ennå. Ingenting deles før du sier ja." : "Not given yet. Nothing is shared until you say yes.")}>
        <div className="panel p-5 md:p-6 max-w-[760px]">
          <ActionForm action={saveConsents} submit={no ? "Lagre samtykkene" : "Save consents"} className="grid gap-3">
            <input type="hidden" name="lang" value={locale} />
            {([
              ["share_field", no ? "Del målingene mine med feltet, samlet med de andre boligene" : "Share my readings with the field, aggregated with the other homes", no ? "Gjør energideling og felles styring mulig. Andre ser aldri dine tall alene." : "Makes energy sharing and shared control possible. Others never see your figures alone."],
              ["share_uia", no ? "Del anonymiserte data med Universitetet i Agder" : "Share anonymised data with the University of Agder", no ? "Til forskning på energi i boligfelt. Kan trekkes tilbake når som helst." : "For research on energy in housing fields. Can be withdrawn at any time."],
              ["allow_control", no ? "La smart styring flytte varmtvann, varmepumpe og lading til billige timer" : "Let smart control move hot water, heat pump and charging to cheap hours", no ? "Du kan alltid overstyre planen." : "You can always override the plan."],
            ] as const).map(([name, label, hint]) => (
              <label key={name} className="flex items-start gap-3 rounded-[var(--radius)] border line p-3.5 bg-white">
                <input type="checkbox" name={name} defaultChecked={!!consents?.[name]} className="mt-1 accent-[var(--fjord)]" />
                <span><span className="block text-[15px]">{label}</span><span className="block text-[13px] text-muted mt-0.5">{hint}</span></span>
              </label>
            ))}
          </ActionForm>
        </div>
      </Section>

      <Section title={no ? "Henvendelser" : "Requests"}>
        <Threads area="resident" items={mine} session={session} locale={locale} askTitle={no ? "Send en henvendelse" : "Send a request"} askHint={no ? "Spørsmål om boligen, feil og mangler, eller noe du lurer på. Bare du og prosjektet ser den." : "Questions about the home, faults, or anything you wonder about. Only you and the project see it."} empty={no ? "Ingen henvendelser ennå." : "No requests yet."} />
      </Section>
    </>
  );
}
