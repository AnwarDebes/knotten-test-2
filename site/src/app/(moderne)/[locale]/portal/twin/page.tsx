import Stage from "@/components/Stage";
import { loadPlots } from "@/lib/data";
import { pageTitle, portalPage } from "@/lib/server/portal";
import { current, symbolText, weather } from "@/lib/server/live";
import NoAccess from "@/components/portal/NoAccess";
import { PageHead, Section, Waiting } from "@/components/portal/ui";

export const dynamic = "force-dynamic";
export const generateMetadata = pageTitle("Digital tvilling", "Digital twin");

/**
 * The digital twin: the same 3D model as the front page, built from Kartverket's laser data, with
 * the energy overlay of the 30 homes. Today it runs on the model; the frame contract below is
 * what live meters will deliver in the same shape.
 */
export default async function Twin({ params }: { params: Promise<{ locale: string }> }) {
  const { locale, no, session, ok } = await portalPage(params, "/twin", "energy");
  if (!ok) return <NoAccess locale={locale} session={session} area="energy" />;
  const [{ plots }, w] = await Promise.all([loadPlots(), weather()]);
  const wx = current(w);
  return (
    <>
      <PageHead
        eyebrow={no ? "Energi" : "Energy"}
        title={no ? "Digital tvilling" : "Digital twin"}
        lede={no ? "Terrenget, trærne og de 30 boligene fra Kartverkets laserdata, med sol og energi time for time. Dra i solen, velg dag og se energien flyte mellom husene." : "The terrain, the trees and the 30 homes from Kartverket's laser data, with sun and energy hour by hour. Drag the sun, pick a day and watch the energy flow between the houses."}
        actions={wx ? <span className="chip">{no ? "Nå på Knotten" : "Now at Knotten"}: {wx.temp.toFixed(1).replace(".", no ? "," : ".")} °C, {symbolText(wx.symbol, no)}</span> : undefined}
      />
      <div className="rounded-[var(--radius-lg)] overflow-hidden border line">
        <Stage plots={plots} locale={locale} initialMode="field" />
      </div>
      <div className="grid gap-5 lg:grid-cols-2">
        <Section title={no ? "Rammekontrakten" : "The frame contract"} sub={no ? "Tvillingen leser én ramme per tidspunkt. I dag kommer rammene fra modellen; målerne skal levere det samme formatet." : "The twin reads one frame per moment. Today the frames come from the model; the meters are to deliver the same format."}>
          <pre className="panel p-4 text-[12.5px] leading-relaxed overflow-x-auto font-mono">{`GET /api/energy/frame?ts=2026-12-21T12:00
{
  "source": "model" | "live",
  "plots": {
    "plot-07": { "pv_kw": 2.1, "load_kw": 1.4, "soc": 0.62,
                 "sharing_to": [{ "plot": "plot-08", "kw": 0.5 }] }
  },
  "field": { "pv_kw": 58.2, "load_kw": 41.0, "import_kw": 0,
             "export_kw": 17.2, "soc": 0.62 }
}`}</pre>
        </Section>
        <Section title={no ? "Neste steg" : "Next steps"}>
          <Waiting no={no} title={no ? "Levende data i tvillingen" : "Live data in the twin"} needs={no ? ["Målinger fra boligene (se Energi og Smarthus)", "Historikk for avspilling av en vinterdag eller et strømbrudd", "Varsler som lyser opp i modellen når noe avviker"] : ["Readings from the homes (see Energy and Smart home)", "History to replay a winter day or a power cut", "Alerts that light up in the model when something deviates"]} />
        </Section>
      </div>
    </>
  );
}
