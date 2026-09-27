import type { Locale } from "@/lib/i18n";
import Nav from "@/components/ui/Nav";
import PageHead from "@/components/ui/PageHead";
import Incoming from "@/components/ui/Incoming";

export default async function Area({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: l } = await params;
  const locale = l as Locale;
  const no = locale === "no";
  const facts = no
    ? [["Sted", "Rødberg, Vigeland, Lindesnes kommune, Agder"], ["Ved", "Audnas utløp i Snigsfjorden"], ["Posisjon", "58.068057 N, 7.278401 Ø"], ["Høyde", "Knotten 87 moh., feltet 38 til 70 moh."], ["Eiendom", "gnr 355 bnr 10 (39 431 m²) og bnr 368, til sammen 40 181 m²"], ["Nabolag", "Gjedeland, Raudberg, Haven, Vollan, utsiktspunktet Fløyen"], ["Veier", "Rødbergsveien, Spangereidveien (fv. 460)"], ["Vann", "Audna, bekkene Harebekken og Ravnåsbekken"], ["Postnummer", "4520 Lindesnes"]]
    : [["Place", "Rødberg, Vigeland, Lindesnes municipality, Agder"], ["By", "The Audna's outlet into Snigsfjorden"], ["Position", "58.068057 N, 7.278401 E"], ["Elevation", "Knotten 87 m, the field 38 to 70 m"], ["Parcel", "cadastral 355/10 (39,431 m²) and 355/368, 40,181 m² in all"], ["Neighbours", "Gjedeland, Raudberg, Haven, Vollan, the Fløyen viewpoint"], ["Roads", "Rødbergsveien, Spangereidveien (fv. 460)"], ["Water", "The Audna, the streams Harebekken and Ravnåsbekken"], ["Postcode", "4520 Lindesnes"]];
  return (
    <>
      <Nav locale={locale} />
      <PageHead
        title={no ? "Området" : "The area"}
        lede={no
          ? "En skogkledd knaus over Audna, der elva vider seg ut mot Snigsfjorden. Gårder i sør, åsen i vest, sjøen i sør. Vigeland med skole, butikker og E39 ligger noen minutter unna."
          : "A wooded knoll above the Audna, where the river widens toward Snigsfjorden. Farms to the south, the ridge to the west, the sea to the south. Vigeland with school, shops and the E39 is a few minutes away."}
      />
      <section className="wrap pb-16 grid gap-12 lg:grid-cols-[1fr_1fr] items-start">
        <div>
          <table className="table max-w-[70ch]"><tbody>{facts.map(([a, b]) => <tr key={a}><th className="w-[130px]">{a}</th><td>{b}</td></tr>)}</tbody></table>
          <p className="provenance mt-4 max-w-[60ch]">{no ? "Stedsnavn og veier fra OpenStreetMap, høyder fra Kartverket, eiendom fra Matrikkelen. Avstander og tjenester legges inn med kilde av markedsgruppen." : "Place names and roads from OpenStreetMap, elevations from Kartverket, parcel from Matrikkelen. Distances and services are added with sources by the market group."}</p>
        </div>
        <div className="grid gap-6">
          <figure className="frame"><img src="/renders/web/site_map.webp" alt="" className="w-full" loading="lazy" /><figcaption className="provenance px-4 py-3">{no ? "1 km rundt Knotten: Kartverket 1 m, 5 m koter, veier og bygg." : "1 km around Knotten: Kartverket 1 m, 5 m contours, roads and buildings."}</figcaption></figure>
        </div>
      </section>

      <section className="wrap section-tight">
        <div className="grid gap-4 md:grid-cols-[1fr_1fr] items-end mb-8">
          <h2 className="display text-[clamp(34px,4.6vw,64px)] max-w-[12ch] rise">{no ? "Fra veien til toppen." : "From the road to the top."}</h2>
          <p className="lede max-w-[46ch] md:justify-self-end rise rise-late">
            {no
              ? "Terrengprofilen gjennom feltet er 409,5 meter lang, fra Rødbergsveien nederst og opp over knausen. Den flate delen ved veien er der kontorbygget og boligen står i dag; sørhellingen over er der tomtene ligger."
              : "The terrain profile through the field is 409.5 metres long, from Rødbergsveien at the bottom up over the knoll. The flat part by the road is where the office and the house stand today; the south slope above is where the plots sit."}
          </p>
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          <Incoming file="terrain_profile.webp" alt={no ? "Terrengprofil A til B" : "Terrain profile A to B"} caption={no ? "Terrengprofil A til B, 409,5 m, fra Norgeskart." : "Terrain profile A to B, 409.5 m, from Norgeskart."} />
          <Incoming file="knotten_terrain_map.webp" alt={no ? "Terrengkart med profillinjen" : "Terrain map with the profile line"} caption={no ? "Knotten med profillinjen A til B og kotene." : "Knotten with the profile line A to B and the contours."} />
        </div>
      </section>

      <section className="wrap section-tight">
        <div className="grid gap-4 md:grid-cols-[1fr_1fr] items-end mb-8">
          <h2 className="display text-[clamp(34px,4.6vw,64px)] max-w-[12ch] rise">{no ? "Eiendommen og skissen." : "The parcel and the sketch."}</h2>
          <p className="lede max-w-[46ch] md:justify-self-end rise rise-late">
            {no
              ? "Feltet er eid av Sigve Simonsen AS. Skissen er prosjekteiers første tanke om hvor veien og husene kan ligge; utlegget i modellen er regnet fra terrenget og byttes ut med den regulerte planen."
              : "The field is owned by Sigve Simonsen AS. The sketch is the project owner's first thought on where the road and the houses might go; the layout in the model is computed from the terrain and will be replaced by the regulated plan."}
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
