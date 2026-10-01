import { isAdmin } from "@/lib/auth";
import { pageTitle, portalPage } from "@/lib/server/portal";
import { meters } from "@/lib/server/records";
import { BUDGET, FACT, fmt } from "@/lib/facts";
import { addUpgrade, clearReadings, importReadings, removeUpgrade, saveBuilding } from "../../actions";
import NoAccess from "@/components/portal/NoAccess";
import { MeterView } from "@/components/portal/MeterView";
import { ActionForm, ConfirmButton } from "@/components/portal/forms";
import { PageHead, Section, Waiting, when } from "@/components/portal/ui";

export const dynamic = "force-dynamic";
export const generateMetadata = pageTitle("Eksisterende bygg", "Existing buildings");

/**
 * The two buildings that already stand on the property: measured history, upgrades with before
 * and after, and the measured performance the new homes will be compared with. The owner loads
 * the meter export (Elhub or the power supplier) here; nothing is shown until real data exists.
 */
export default async function ExistingBuildings({ params }: { params: Promise<{ locale: string }> }) {
  const { locale, no, session, ok } = await portalPage(params, "/energy/eksisterende", "energy");
  if (!ok) return <NoAccess locale={locale} session={session} area="energy" />;
  const admin = isAdmin(session);
  const { buildings } = await meters.read();
  const lang = no ? "no" : "en";
  return (
    <>
      <PageHead
        eyebrow={no ? "Energi" : "Energy"}
        title={no ? "Eksisterende bygg" : "Existing buildings"}
        lede={no ? `Kontorbygget (${FACT.offices_now} kontorer i dag) og boligen står allerede. Målt forbruk gir historikken, viser effekten av tiltak før og etter, og blir sammenligningsgrunnlaget for de nye boligene. Energiregnskapet bruker i dag en arbeidsforutsetning på ${fmt(BUDGET.office_kwh, lang)} kWh i året for kontoret.` : `The office building (${FACT.offices_now} offices today) and the house already stand. Measured consumption gives the history, shows the effect of upgrades before and after, and becomes the basis of comparison for the new homes. The energy budget uses a working assumption of ${fmt(BUDGET.office_kwh, "en")} kWh a year for the office today.`}
      />
      {buildings.map((b) => (
        <Section
          key={b.id}
          title={b.name[locale]}
          sub={b.readings.length ? (no ? `${b.readings.length} måneder, ${b.readings[0].month} til ${b.readings[b.readings.length - 1].month}. Kilde: ${b.source ?? "ukjent"}, lagt inn ${when(b.updated, locale, false)}.` : `${b.readings.length} months, ${b.readings[0].month} to ${b.readings[b.readings.length - 1].month}. Source: ${b.source ?? "unknown"}, added ${when(b.updated, locale, false)}.`) : undefined}
          actions={b.readings.length ? <span className={`chip ${b.public ? "chip-pine" : ""}`}>{b.public ? (no ? "Vises på nettsiden" : "Shown on the website") : (no ? "Bare i portalen" : "Portal only")}</span> : <span className="chip chip-amber">{no ? "Ingen målinger ennå" : "No readings yet"}</span>}
        >
          <div className={admin ? "grid gap-5 xl:grid-cols-[1.7fr_1fr] items-start" : ""}>
            <div className="panel p-4 md:p-5">
              {b.readings.length ? <MeterView b={b} locale={locale} /> : (
                <Waiting no={no} title={no ? "Forbrukshistorikk" : "Consumption history"} needs={no ? ["Målepunkt-ID for bygget (står på nettleiefakturaen)", "Eksport av måleverdier fra Elhub (elhub.no, Min side) eller fra strømleverandøren, som CSV", "Datoer for tiltak som er gjort: varmepumpe, etterisolering, vinduer, solceller"] : ["The metering point ID for the building (on the grid invoice)", "An export of meter values from Elhub (elhub.no) or the power supplier, as CSV", "Dates of upgrades done: heat pump, insulation, windows, solar"]} />
              )}
            </div>
            {admin && (
              <div className="grid gap-4">
                <div className="panel p-5 grid gap-3">
                  <div className="font-medium">{no ? "Last inn målerdata" : "Load meter data"}</div>
                  <ActionForm action={importReadings} submit={no ? "Les inn" : "Import"} pending={no ? "Leser …" : "Reading …"}>
                    <input type="hidden" name="building" value={b.id} />
                    <input type="hidden" name="lang" value={locale} />
                    <input type="file" name="file" accept=".csv,.txt,text/csv,text/plain" className="input !py-2 text-[14px]" />
                    <textarea name="text" rows={3} className="input !text-[13.5px] font-mono" placeholder={no ? "eller lim inn: 2025-01;2450" : "or paste: 2025-01,2450"} />
                    <input name="source" className="input !py-2" placeholder={no ? "Kilde, f.eks. Elhub, timeverdier 2023 til 2026" : "Source, e.g. Elhub hourly values 2023 to 2026"} />
                    <p className="text-[12.5px] text-muted">{no ? "Time-, døgn- eller månedsverdier; summeres per måned. Måneder som finnes fra før, erstattes." : "Hourly, daily or monthly values; summed per month. Months already present are replaced."}</p>
                  </ActionForm>
                </div>
                <div className="panel p-5 grid gap-3">
                  <div className="font-medium">{no ? "Registrer et tiltak" : "Register an upgrade"}</div>
                  <ActionForm action={addUpgrade} submit={no ? "Legg til" : "Add"}>
                    <input type="hidden" name="building" value={b.id} />
                    <input type="hidden" name="lang" value={locale} />
                    <input name="title" required className="input !py-2" placeholder={no ? "Hva ble gjort, f.eks. luft-til-vann varmepumpe" : "What was done, e.g. air-to-water heat pump"} />
                    <div className="grid grid-cols-2 gap-2"><input name="date" type="date" required className="input !py-2" /><input name="cost" inputMode="numeric" className="input !py-2" placeholder={no ? "Kostnad, kr" : "Cost, kr"} /></div>
                    <input name="detail" className="input !py-2" placeholder={no ? "Detaljer (valgfritt)" : "Details (optional)"} />
                  </ActionForm>
                  {b.upgrades.length > 0 && (
                    <ul className="grid gap-1 text-[13.5px]">
                      {b.upgrades.map((u) => <li key={u.id} className="flex justify-between gap-2"><span>{u.date} {u.title}</span><ConfirmButton action={removeUpgrade} fields={{ building: b.id, id: u.id }} label={no ? "Fjern" : "Remove"} question={no ? `Fjerne «${u.title}»?` : `Remove "${u.title}"?`} /></li>)}
                    </ul>
                  )}
                </div>
                <div className="panel p-5 grid gap-3 text-[14px]">
                  <form action={saveBuilding} className="grid gap-3">
                    <input type="hidden" name="building" value={b.id} />
                    <label className="grid gap-1.5"><span className="font-medium">{no ? "Oppvarmet areal" : "Heated floor area"}</span><input name="area_m2" inputMode="decimal" defaultValue={b.area_m2 ?? ""} className="input !py-2" placeholder="m²" /></label>
                    <label className="flex items-center gap-2"><input type="checkbox" name="public" defaultChecked={b.public} /> {no ? "Vis forbruket på nettsiden (eksisterende bygg)" : "Show the consumption on the website (existing buildings)"}</label>
                    <button className="btn btn-sm btn-ghost btn-plain justify-self-start">{no ? "Lagre" : "Save"}</button>
                  </form>
                  {b.readings.length > 0 && <ConfirmButton action={clearReadings} fields={{ building: b.id }} label={no ? "Slett alle målinger" : "Delete all readings"} question={no ? `Slette alle målinger for ${b.name.no}?` : `Delete all readings for ${b.name.en}?`} />}
                </div>
              </div>
            )}
          </div>
        </Section>
      ))}
    </>
  );
}
