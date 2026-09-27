import type { Locale } from "@/lib/i18n";
import { readStore } from "@/lib/store";
import { ASSUMPTIONS, ASSUMPTIONS_VERSION } from "@/lib/assumptions";
import { saveSettings } from "../actions";

export const dynamic = "force-dynamic";

/** The few things the owner may want to change without a developer, and the figures the site is built on. */
export default async function Settings({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: l } = await params;
  const locale = l as Locale;
  const no = locale === "no";
  const { settings } = await readStore();
  return (
    <div className="grid gap-10">
      <div className="grid gap-8 lg:grid-cols-[1fr_1fr]">
        <div>
          <h1 className="display text-[clamp(34px,4.5vw,56px)]">{no ? "Innstillinger" : "Settings"}</h1>
          <p className="text-[15px] text-muted mt-2 max-w-[52ch]">{no ? "Beskjeden om når tomtene slippes står på tomtesidene og i skjemaet. Kontaktopplysningene brukes i bunnen av hver side." : "The message about when plots are released shows on the plot pages and in the form. The contact details are used at the foot of every page."}</p>
        </div>
        <form action={saveSettings} className="panel p-5 md:p-6 grid gap-3 content-start">
          <label className="grid gap-1 text-[13px]">{no ? "Når slippes tomtene (norsk)" : "When plots are released (Norwegian)"}<input className="input !py-2" name="release_no" defaultValue={settings.release_note.no} /></label>
          <label className="grid gap-1 text-[13px]">{no ? "Når slippes tomtene (engelsk)" : "When plots are released (English)"}<input className="input !py-2" name="release_en" defaultValue={settings.release_note.en} /></label>
          <label className="grid gap-1 text-[13px]">{no ? "Kontakt, e-post" : "Contact email"}<input className="input !py-2" name="contact_email" defaultValue={settings.contact_email} /></label>
          <label className="grid gap-1 text-[13px]">{no ? "Kontakt, telefon" : "Contact phone"}<input className="input !py-2" name="contact_phone" defaultValue={settings.contact_phone} /></label>
          <label className="flex items-center gap-2 text-[14px]"><input type="checkbox" name="weekly_digest" defaultChecked={settings.weekly_digest} /> {no ? "Ukentlig sammendrag på e-post (i produksjon)" : "Weekly summary by email (in production)"}</label>
          <button className="btn btn-amber btn-sm justify-self-start">{no ? "Lagre" : "Save"}</button>
        </form>
      </div>
      <div>
        <h2 className="display text-[28px]">{no ? "Tallene nettsiden bygger på" : "The figures the site is built on"} <span className="text-muted text-[16px] font-body font-normal ml-2">{ASSUMPTIONS_VERSION}</span></h2>
        <p className="text-[14px] text-muted mt-2 max-w-[60ch]">{no ? "Målte tall kommer fra modellen og endres når den regnes på nytt. Foreløpige tall byttes ut når rapportene fra energi- og markedsgruppen leveres." : "Measured figures come from the model and change when it is recomputed. Provisional figures are replaced when the energy and market group reports are delivered."}</p>
        <div className="overflow-x-auto mt-4">
          <table className="table max-w-[110ch]">
            <thead><tr><th>{no ? "Hva" : "What"}</th><th className="n">{no ? "Verdi" : "Value"}</th><th>{no ? "Kilde" : "Source"}</th><th>{no ? "Dato" : "Date"}</th><th></th></tr></thead>
            <tbody>{ASSUMPTIONS.map((a) => <tr key={a.key}><td>{a.label[locale]}</td><td className="n whitespace-nowrap">{a.value} {a.unit}</td><td>{a.source}</td><td className="whitespace-nowrap">{a.date}</td><td>{a.provisional ? <span className="chip chip-amber">{no ? "foreløpig" : "provisional"}</span> : <span className="chip chip-pine">{no ? "målt" : "measured"}</span>}</td></tr>)}</tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
