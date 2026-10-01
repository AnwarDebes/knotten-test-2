import type { Locale } from "@/lib/i18n";
import Nav from "@/components/ui/Nav";
import PageHead from "@/components/ui/PageHead";
import Incoming from "@/components/ui/Incoming";
import { FACT, fmt } from "@/lib/facts";
import { pageMeta } from "@/lib/meta";
import { isLocale } from "@/lib/i18n";
import { notFound } from "next/navigation";

export const generateMetadata = pageMeta("/omradet", {
  no: { title: "Området", description: "En skogkledd knaus over Audna, nær der elva renner ut i Sniksfjorden. Vigeland, med skole, butikker og E39, ligger noen få kilometer nordøst." },
  en: { title: "The area", description: "A wooded knoll above the Audna, near where the river flows into Sniksfjorden. Vigeland, with school, shops and the E39, is a few kilometres north-east." },
});

export default async function Area({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: l } = await params;
  if (!isLocale(l)) notFound();
  const locale = l as Locale;
  const no = locale === "no";
  const nb = (v: number) => fmt(v, no ? "no" : "en");
  const facts = no
    ? [["Sted", "Rødberg, Lindesnes kommune, Agder"], ["Ved", "Audna, nær utløpet i Sniksfjorden ved Snig"], ["Posisjon", `${FACT.lat} N, ${FACT.lon} Ø`], ["Høyde", `Knotten om lag ${FACT.knotten_m} moh., Løkkeheia bak feltet ${nb(FACT.lokkeheia_m)} moh.`], ["Eiendom", `gnr ${FACT.gnr} bnr ${FACT.bnr} (${nb(FACT.parcel_bnr10_m2)} m²) og bnr ${FACT.bnr_extra}, til sammen ${nb(FACT.parcel_m2)} m²`], ["Stedsnavn rundt", "Løkkeheia, Storhaugen, Haugen og Gjedeland"], ["Veier", "Rødbergsveien, Spangereidveien (fv. 460)"], ["Vann", "Audna, bekkene Harebekken og Ravnåsbekken"], ["Postnummer", FACT.postcode]]
    : [["Place", "Rødberg, Lindesnes municipality, Agder"], ["By", "The Audna, near its outlet into Sniksfjorden at Snig"], ["Position", `${FACT.lat} N, ${FACT.lon} E`], ["Elevation", `Knotten about ${FACT.knotten_m} m, Løkkeheia behind the field ${nb(FACT.lokkeheia_m)} m`], ["Parcel", `cadastral ${FACT.gnr}/${FACT.bnr} (${nb(FACT.parcel_bnr10_m2)} m²) and ${FACT.gnr}/${FACT.bnr_extra}, ${nb(FACT.parcel_m2)} m² in all`], ["Place names around", "Løkkeheia, Storhaugen, Haugen and Gjedeland"], ["Roads", "Rødbergsveien, Spangereidveien (fv. 460)"], ["Water", "The Audna, the streams Harebekken and Ravnåsbekken"], ["Postcode", FACT.postcode]];
  return (
    <>
      <Nav locale={locale} />
      <PageHead
        title={no ? "Området" : "The area"}
        lede={no
          ? "En skogkledd knaus over Audna, nær der elva renner ut i Sniksfjorden. Gårder i sør, åsen i vest, sjøen i sør. Vigeland, med skole, butikker og E39, ligger noen få kilometer nordøst."
          : "A wooded knoll above the Audna, near where the river flows into Sniksfjorden. Farms to the south, the ridge to the west, the sea to the south. Vigeland, with school, shops and the E39, is a few kilometres north-east."}
      />
      <section className="wrap pb-16 grid gap-12 lg:grid-cols-[1fr_1fr] items-start">
        <div>
          <table className="table max-w-[70ch]"><tbody>{facts.map(([a, b]) => <tr key={a}><th className="w-[130px]">{a}</th><td>{b}</td></tr>)}</tbody></table>
          <p className="provenance mt-4 max-w-[60ch]">{no ? "Stedsnavn og høyder fra Kartverket og prosjekteiers kart, veier fra OpenStreetMap, eiendom fra Matrikkelen. Avstander og tjenester legges inn med kilde av markedssporet." : "Place names and elevations from Kartverket and the project owner's maps, roads from OpenStreetMap, parcel from Matrikkelen. Distances and services are added with sources by the market track."}</p>
        </div>
        <div className="grid gap-6">
          <figure className="frame"><img src="/renders/web/site_map.webp" alt="" className="w-full" loading="lazy" /><figcaption className="provenance px-4 py-3">{no ? "1 km rundt Knotten, laget for nettsiden: Kartverket 1 m, 5 m koter, veier og bygg fra OpenStreetMap." : "1 km around Knotten, made for the website: Kartverket 1 m, 5 m contours, roads and buildings from OpenStreetMap."}</figcaption></figure>
        </div>
      </section>

      <section className="wrap section-tight">
        <div className="grid gap-4 md:grid-cols-[1fr_1fr] items-end mb-8">
          <h2 className="display text-[clamp(34px,4.6vw,64px)] max-w-[12ch] rise">{no ? "Fra veien til toppen." : "From the road to the top."}</h2>
          <p className="lede max-w-[46ch] md:justify-self-end rise rise-late">
            {no
              ? `Terrengprofilen i Norgeskart er ${nb(FACT.profile_m)} meter lang, fra vannet ved Spangereidveien og opp til Knotten. Den flate delen ved veien er der kontorbygget og boligen står i dag; sørhellingen over er der tomtene ligger.`
              : `The terrain profile in Norgeskart is ${nb(FACT.profile_m)} metres long, from the water by Spangereidveien up to Knotten. The flat part by the road is where the office and the house stand today; the south slope above is where the plots sit.`}
          </p>
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          <Incoming file="terrain_profile.webp" alt={no ? "Terrengprofil A til B" : "Terrain profile A to B"} caption={no ? `Terrengprofil A til B, ${nb(FACT.profile_m)} m, fra Norgeskart.` : `Terrain profile A to B, ${nb(FACT.profile_m)} m, from Norgeskart.`} />
          <Incoming file="knotten_terrain_map.webp" alt={no ? "Prosjekteiers kart over siktlinjen ut til åpent hav" : "The project owner's map of the sight line to open sea"} caption={no ? "Siktlinjen fra byggefeltet ut til åpent hav. Kart: prosjekteier." : "The sight line from the building field out to open sea. Map: the project owner."} />
        </div>
      </section>

      <section className="wrap section-tight">
        <div className="grid gap-4 md:grid-cols-[1fr_1fr] items-end mb-8">
          <h2 className="display text-[clamp(34px,4.6vw,64px)] max-w-[12ch] rise">{no ? "Eiendommen og skissen." : "The parcel and the sketch."}</h2>
          <p className="lede max-w-[46ch] md:justify-self-end rise rise-late">
            {no
              ? "Knotten er et eget eid byggefelt, og prosjekteier er Sigve Simonsen AS. Skissen er prosjekteiers første tanke om hvor veien og husene kan ligge; utlegget i modellen er regnet fra terrenget og byttes ut med den regulerte planen."
              : "Knotten is a privately owned building site, and the project owner is Sigve Simonsen AS. The sketch is the project owner's first thought on where the road and the houses might go; the layout in the model is computed from the terrain and will be replaced by the regulated plan."}
          </p>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          <Incoming file="norgeskart_property.webp" alt={no ? "Eiendommen på Norgeskart" : "The parcel on Norgeskart"} caption={no ? "Eiendommen på Norgeskart." : "The parcel on Norgeskart."} />
          <Incoming file="knotten_map.webp" alt={no ? "Knotten på kartet" : "Knotten on the map"} caption={no ? "Knotten på eiendomskartet, mellom Løkkeheia og Raudberg." : "Knotten on the cadastral map, between Løkkeheia and Raudberg."} />
          <Incoming file="site_plan_sketch.webp" alt={no ? "Plan­skisse" : "Plan sketch"} caption={no ? "Prosjekteiers skisse av vei og tomter." : "The project owner's sketch of road and plots."} />
        </div>
      </section>
    </>
  );
}
