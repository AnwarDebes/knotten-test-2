import { pageTitle, portalPage } from "@/lib/server/portal";
import { readStore } from "@/lib/store";
import { ASSUMPTIONS, ASSUMPTIONS_VERSION } from "@/lib/facts";
import { STORAGE } from "@/lib/server/kv";
import { MAIL_ON } from "@/lib/server/mail";
import { FILES_ON, MAX_BYTES, prettySize } from "@/lib/server/files";
import { saveSettings, sendDigestNow } from "../actions";
import { buildDigest } from "@/lib/server/digest";
import { ActionForm } from "@/components/portal/forms";
import Icon from "@/components/portal/Icon";
import NoAccess from "@/components/portal/NoAccess";
import { PageHead, Section } from "@/components/portal/ui";

export const dynamic = "force-dynamic";
export const generateMetadata = pageTitle("Innstillinger", "Settings");

/**
 * What the owner may change without a developer, the state of the services the site runs on,
 * and the figures the site is built on.
 */
export default async function Settings({ params }: { params: Promise<{ locale: string }> }) {
  const { locale, no, session, ok } = await portalPage(params, "/admin/innstillinger", "admin");
  if (!ok) return <NoAccess locale={locale} session={session} area="admin" />;
  const { settings } = await readStore();
  // the preview is exactly what Monday's email will say, in the language chosen for it
  const digestLang = settings.digest_lang ?? "no";
  const digest = await buildDigest(digestLang);
  const cron = !!process.env.CRON_SECRET;
  const prod = process.env.NODE_ENV === "production";
  const services: { name: string; ok: boolean; state: string; how: string }[] = no
    ? [
        { name: "Lagring av data", ok: STORAGE !== "temp", state: STORAGE === "kv" ? "Database (Redis/KV)" : STORAGE === "file" ? "Filer på serveren (site/data)" : "Midlertidig: glemmes når serveren sover", how: "På Vercel: koble en Redis-database (Upstash) til prosjektet. Variablene KV_REST_API_URL og KV_REST_API_TOKEN settes da automatisk." },
        { name: "Innloggingsnøkkel", ok: !!process.env.AUTH_SECRET || !prod, state: process.env.AUTH_SECRET ? "AUTH_SECRET er satt" : "Nøkkel lagret sammen med kontoene", how: "Sett AUTH_SECRET til en lang, tilfeldig tekst (minst 32 tegn) i produksjon." },
        { name: "E-post", ok: MAIL_ON, state: MAIL_ON ? `Sender fra ${process.env.MAIL_FROM}` : "Ikke satt opp: lenker vises for kopiering", how: "Opprett en konto hos Resend, bekreft domenet, og sett RESEND_API_KEY og MAIL_FROM." },
        { name: "Fillagring", ok: FILES_ON, state: FILES_ON ? `På plass, inntil ${prettySize(MAX_BYTES)} per fil` : "Ikke satt opp: opplasting er slått av", how: "På Vercel: koble en Blob-lagring til prosjektet (BLOB_READ_WRITE_TOKEN). Filene lagres private." },
        { name: "Ukentlig sammendrag", ok: cron || !settings.weekly_digest, state: cron ? "Planlagt mandag morgen (Vercel Cron)" : settings.weekly_digest ? "Slått på, men ikke planlagt" : "Slått av", how: "Sett CRON_SECRET i Vercel (en lang, tilfeldig tekst). Tidsplanen står i vercel.json; e-post må også være satt opp." },
        { name: "Nettadresse i lenker", ok: !!process.env.SITE_URL || !prod, state: process.env.SITE_URL ?? "Hentes fra forespørselen", how: "Sett SITE_URL, for eksempel https://knotten.no, så lenker i e-post alltid peker riktig." },
      ]
    : [
        { name: "Data storage", ok: STORAGE !== "temp", state: STORAGE === "kv" ? "Database (Redis/KV)" : STORAGE === "file" ? "Files on the server (site/data)" : "Temporary: forgotten when the server sleeps", how: "On Vercel: connect a Redis database (Upstash) to the project. KV_REST_API_URL and KV_REST_API_TOKEN are then set automatically." },
        { name: "Login key", ok: !!process.env.AUTH_SECRET || !prod, state: process.env.AUTH_SECRET ? "AUTH_SECRET is set" : "Key stored with the accounts", how: "Set AUTH_SECRET to a long random text (at least 32 characters) in production." },
        { name: "Email", ok: MAIL_ON, state: MAIL_ON ? `Sending from ${process.env.MAIL_FROM}` : "Not set up: links are shown to copy", how: "Create a Resend account, verify the domain, and set RESEND_API_KEY and MAIL_FROM." },
        { name: "File storage", ok: FILES_ON, state: FILES_ON ? `In place, up to ${prettySize(MAX_BYTES, false)} per file` : "Not set up: uploads are off", how: "On Vercel: connect a Blob store to the project (BLOB_READ_WRITE_TOKEN). Files are stored private." },
        { name: "Weekly summary", ok: cron || !settings.weekly_digest, state: cron ? "Scheduled Monday morning (Vercel Cron)" : settings.weekly_digest ? "Switched on, but not scheduled" : "Switched off", how: "Set CRON_SECRET in Vercel (a long random text). The schedule is in vercel.json; email must be set up too." },
        { name: "Address in links", ok: !!process.env.SITE_URL || !prod, state: process.env.SITE_URL ?? "Taken from the request", how: "Set SITE_URL, for example https://knotten.no, so links in emails always point right." },
      ];
  return (
    <>
      <PageHead eyebrow={no ? "Administrasjon" : "Administration"} title={no ? "Innstillinger" : "Settings"} lede={no ? "Det du kan endre uten utvikler, tjenestene nettsiden står på, og tallene den bygger på." : "What you can change without a developer, the services the site runs on, and the figures it builds on."} />
      <div className="grid gap-6 xl:grid-cols-2 items-start">
        <Section title={no ? "Nettsiden" : "The website"}>
          <form action={saveSettings} className="panel p-5 md:p-6 grid gap-3">
            <label className="grid gap-1.5 text-[13.5px]"><span className="font-medium text-ink-2">{no ? "Når slippes tomtene (norsk)" : "When plots are released (Norwegian)"}</span><input className="input !py-2" name="release_no" defaultValue={settings.release_note.no} /></label>
            <label className="grid gap-1.5 text-[13.5px]"><span className="font-medium text-ink-2">{no ? "Når slippes tomtene (engelsk)" : "When plots are released (English)"}</span><input className="input !py-2" name="release_en" defaultValue={settings.release_note.en} /></label>
            <label className="grid gap-1.5 text-[13.5px]"><span className="font-medium text-ink-2">{no ? "E-post for varsler om nye interessenter og henvendelser" : "Email for alerts about new leads and questions"}</span><input className="input !py-2" type="email" name="contact_email" defaultValue={settings.contact_email} /></label>
            <label className="grid gap-1.5 text-[13.5px]"><span className="font-medium text-ink-2">{no ? "Telefon" : "Phone"}</span><input className="input !py-2" name="contact_phone" defaultValue={settings.contact_phone} /></label>
            <label className="flex items-center gap-2 text-[14px]"><input type="checkbox" name="weekly_digest" defaultChecked={settings.weekly_digest} /> {no ? "Send meg et sammendrag på e-post hver mandag morgen" : "Email me a summary every Monday morning"}</label>
            <label className="grid gap-1.5 text-[13.5px]"><span className="font-medium text-ink-2">{no ? "Språk i sammendraget" : "Language of the summary"}</span><select key={digestLang} className="input !py-2" name="digest_lang" defaultValue={digestLang}><option value="no">Norsk</option><option value="en">English</option></select></label>
            <p className="text-[12.5px] text-muted">{no ? "Beskjeden om når tomtene slippes, står på tomtesidene i moderne utseende." : "The release message shows on the plot pages in the modern design."}</p>
            <button className="btn btn-sm justify-self-start">{no ? "Lagre" : "Save"}</button>
          </form>
        </Section>
        <Section title={no ? "Tjenester" : "Services"} sub={no ? "Det som må være på plass når nettsiden settes i drift. Detaljene står i README.md." : "What must be in place when the site goes live. The details are in README.md."}>
          <div className="panel divide-y divide-[var(--line)]">
            {services.map((s) => (
              <div key={s.name} className="p-4 grid gap-1">
                <div className="flex flex-wrap items-center justify-between gap-2"><span className="font-medium text-[14.5px]">{s.name}</span><span className={`chip ${s.ok ? "chip-pine" : "chip-amber"}`}>{s.ok ? (no ? "I orden" : "In order") : (no ? "Må settes opp" : "Needs setting up")}</span></div>
                <div className="text-[13.5px] text-ink-2">{s.state}</div>
                {!s.ok && <div className="text-[13px] text-muted">{s.how}</div>}
              </div>
            ))}
          </div>
        </Section>
      </div>
      <div className="grid gap-6 xl:grid-cols-[1.4fr_1fr] items-start">
        <Section title={no ? "Ukens sammendrag" : "This week's summary"} sub={no ? `Slik ser e-posten ut hvis den sendes nå, på ${digestLang === "en" ? "engelsk" : "norsk"}. Den går til ${settings.contact_email} mandag morgen når sammendraget er slått på.` : `This is how the email looks if sent now, in ${digestLang === "en" ? "English" : "Norwegian"}. It goes to ${settings.contact_email} on Monday mornings when the summary is switched on.`}>
          <div className="panel p-5 md:p-6 grid gap-3">
            <div className="text-[14px]"><span className="text-muted">{no ? "Emne: " : "Subject: "}</span><span className="font-medium">{digest.subject}</span></div>
            <pre className="whitespace-pre-wrap text-[13px] leading-relaxed bg-bg/70 rounded-[var(--radius)] p-4 font-mono max-h-[420px] overflow-auto">{digest.text}</pre>
            <ActionForm action={sendDigestNow} submit={no ? "Send en prøve til meg nå" : "Send a test to me now"} pending={no ? "Sender …" : "Sending …"} buttonClass="btn btn-sm btn-ghost btn-plain justify-self-start">
              <input type="hidden" name="lang" value={locale} />
            </ActionForm>
          </div>
        </Section>
        <Section title={no ? "Sikkerhetskopi" : "Backup"} sub={no ? "Alt nettsiden og portalen har lagret, som én fil: interessenter, tomter, nyheter, innstillinger, kontoer (uten passord), dokumentlisten, henvendelser, prosjektrommet, samtykker, målerdata og statistikk." : "Everything the website and portal have stored, as one file: leads, plots, news, settings, accounts (without passwords), the document list, questions, the project room, consents, meter data and statistics."}>
          <div className="panel p-5 md:p-6 grid gap-3 text-[14px]">
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- a file download from an API route, not a page */}
            <a className="btn btn-sm no-underline justify-self-start" href="/api/backup"><Icon name="download" size={16} />{no ? "Last ned sikkerhetskopi" : "Download backup"}</a>
            <p className="text-muted text-[13px]">{no ? "Ta en kopi jevnlig og oppbevar den trygt: filen inneholder personopplysninger. Selve dokumentfilene lastes ned fra Dokumenter." : "Take a copy regularly and keep it safe: the file contains personal data. The document files themselves are downloaded from Documents."}</p>
          </div>
        </Section>
      </div>
      <Section title={no ? "Tallene nettsiden bygger på" : "The figures the site is built on"} sub={`${no ? "Versjon" : "Version"} ${ASSUMPTIONS_VERSION} (${no ? "foreløpig" : "provisional"}). ${no ? "Målte tall kommer fra modellen og endres når den regnes på nytt; foreløpige tall byttes ut når rapportene fra energi- og markedssporet leveres." : "Measured figures come from the model and change when it is recomputed; provisional figures are replaced when the energy and market track reports are delivered."}`}>
        <div className="panel scroll-x">
          <table className="table table-tight min-w-[720px]">
            <thead><tr><th>{no ? "Hva" : "What"}</th><th className="n">{no ? "Verdi" : "Value"}</th><th>{no ? "Kilde" : "Source"}</th><th>{no ? "Dato" : "Date"}</th><th><span className="sr-only">Status</span></th></tr></thead>
            <tbody>{ASSUMPTIONS.map((a) => <tr key={a.key}><td>{a.label[locale]}</td><td className="n whitespace-nowrap">{a.value.toLocaleString(no ? "nb-NO" : "en-GB")} {a.unit[locale]}</td><td>{a.source[locale]}</td><td className="whitespace-nowrap">{a.date}</td><td className="whitespace-nowrap">{a.provisional ? <span className="chip chip-amber">{no ? "foreløpig" : "provisional"}</span> : <span className="chip chip-pine">{no ? "fastsatt" : "settled"}</span>}</td></tr>)}</tbody>
          </table>
        </div>
      </Section>
    </>
  );
}
