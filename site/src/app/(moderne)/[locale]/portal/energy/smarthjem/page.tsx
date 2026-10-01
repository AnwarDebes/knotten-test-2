import { pageTitle, portalPage } from "@/lib/server/portal";
import { measure } from "@/lib/facts";
import NoAccess from "@/components/portal/NoAccess";
import Icon, { type IconName } from "@/components/portal/Icon";
import { PageHead, Section, Waiting } from "@/components/portal/ui";

export const dynamic = "force-dynamic";
export const generateMetadata = pageTitle("Smarthus", "Smart home");

/**
 * Smart-home integration: the devices the energy concept counts on, how each one will talk to
 * the platform, and that none is connected yet. A placeholder by design: there is no house to
 * connect to before the field is built, and the equipment is not chosen.
 */
export default async function SmartHome({ params }: { params: Promise<{ locale: string }> }) {
  const { locale, no, session, ok } = await portalPage(params, "/energy/smarthjem", "energy");
  if (!ok) return <NoAccess locale={locale} session={session} area="energy" />;
  const display = measure("energy_display"), control = measure("smart_control"), battery = measure("battery_home");
  const devices: { icon: IconName; name: string; does: string; how: string }[] = no
    ? [
        { icon: "pulse", name: "Strømmåleren (HAN-port)", does: "Forbruk og produksjon i sanntid, hvert 2. til 10. sekund.", how: "En HAN-leser kobles i måleren. Data går til plattformen over WiFi (MQTT)." },
        { icon: "sun", name: "Solcelleanlegget", does: "Produksjon per bolig og for fellesanlegget.", how: "Vekselretterens lokale grensesnitt (Modbus TCP eller SunSpec) eller produsentens skytjeneste." },
        { icon: "bolt", name: "Hjemmebatteriet", does: "Ladetilstand, lading og utlading; styres etter planen under Smart styring.", how: "Batteristyringens grensesnitt (Modbus TCP) eller produsentens API." },
        { icon: "gear", name: "Varmepumpe og varmtvann", does: "Forvarming i billige timer, senking når strømmen er dyr.", how: "Styring via varmepumpens grensesnitt (Modbus eller produsentens API) eller et styrbart rele for varmtvannsberederen." },
        { icon: "plug", name: "Elbillader", does: "Lading i de billigste timene innen tiden bilen skal være klar.", how: "OCPP, standarden laderne bruker mot styringssystemer." },
        { icon: "house", name: "Beboerens app og overstyring", does: "Beboeren ser sin egen energi og kan alltid overstyre planen.", how: "Under Mitt hjem i portalen, med samtykkene beboeren har gitt." },
      ]
    : [
        { icon: "pulse", name: "The power meter (HAN port)", does: "Use and production in real time, every 2 to 10 seconds.", how: "A HAN reader plugs into the meter. Data goes to the platform over WiFi (MQTT)." },
        { icon: "sun", name: "The solar plant", does: "Production per home and for the shared plant.", how: "The inverter's local interface (Modbus TCP or SunSpec) or the maker's cloud service." },
        { icon: "bolt", name: "The home battery", does: "State of charge, charging and discharging; controlled by the plan under Smart control.", how: "The battery controller's interface (Modbus TCP) or the maker's API." },
        { icon: "gear", name: "Heat pump and hot water", does: "Preheating in cheap hours, lowering when power is dear.", how: "Control through the heat pump's interface (Modbus or the maker's API) or a switchable relay for the water heater." },
        { icon: "plug", name: "Electric car charger", does: "Charging in the cheapest hours before the car must be ready.", how: "OCPP, the standard chargers use towards control systems." },
        { icon: "house", name: "The resident's app and override", does: "The resident sees their own energy and can always override the plan.", how: "Under My home in the portal, with the consents the resident has given." },
      ];
  return (
    <>
      <PageHead
        eyebrow={no ? "Energi" : "Energy"}
        title={no ? "Smarthus" : "Smart home"}
        lede={no ? "Utstyret energikonseptet regner med i hver bolig, og hvordan det skal snakke med plattformen. Ingenting er koblet til ennå: boligene er ikke bygget, og utstyret er ikke valgt." : "The equipment the energy concept counts on in each home, and how it will talk to the platform. Nothing is connected yet: the homes are not built and the equipment is not chosen."}
        actions={<span className="chip chip-amber">{no ? "Plassholder" : "Placeholder"}</span>}
      />
      <Section title={no ? "Utstyret" : "The equipment"}>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {devices.map((d) => (
            <div key={d.name} className="panel p-5 grid content-start gap-2">
              <div className="flex items-center justify-between gap-3">
                <span className="flex items-center gap-2 font-medium"><Icon name={d.icon} className="text-fjord" />{d.name}</span>
                <span className="chip">{no ? "Ikke tilkoblet" : "Not connected"}</span>
              </div>
              <p className="text-[14.5px] text-ink-2">{d.does}</p>
              <p className="text-[13.5px] text-muted">{d.how}</p>
            </div>
          ))}
        </div>
      </Section>
      <Section title={no ? "Det energisporet har vurdert" : "What the energy track assessed"}>
        <div className="grid gap-3 md:grid-cols-3">
          {[display, control, battery].map((m) => (
            <div key={m.id} className="panel p-5 grid content-start gap-1.5">
              <div className="flex items-center justify-between gap-2"><span className="font-medium">{m.name[locale]}</span><span className={`chip ${m.verdict === "yes" ? "chip-pine" : "chip-amber"}`}>{m.verdict === "yes" ? (no ? "Ja" : "Yes") : (no ? "Kanskje" : "Maybe")}</span></div>
              <p className="text-[14px] text-ink-2">{m.what[locale]}</p>
              <p className="text-[13.5px] text-muted">{m.why[locale]}</p>
            </div>
          ))}
        </div>
      </Section>
      <Waiting no={no} title={no ? "Tilkobling av utstyret" : "Connecting the equipment"} needs={no ? ["Valg av batteri, vekselretter, varmepumpe og lader, med åpne grensesnitt", "Energikontrakten fra energisporet, som sier hvilke verdier som lagres", "En test i en eksisterende bygning først, for eksempel kontorbygget"] : ["A choice of battery, inverter, heat pump and charger with open interfaces", "The energy contract from the energy track, saying which values are stored", "A test in an existing building first, for example the office building"]}>
        {no ? "Plattformen har plassen klar: målingene går inn i de samme visningene som modellen bruker i dag, og styringen tar planen fra Smart styring." : "The platform has the place ready: the readings go into the same views the model uses today, and the control takes its plan from Smart control."}
      </Waiting>
    </>
  );
}
