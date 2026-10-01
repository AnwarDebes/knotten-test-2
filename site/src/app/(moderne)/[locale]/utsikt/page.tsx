import type { Locale } from "@/lib/i18n";
import Nav from "@/components/ui/Nav";
import PageHead from "@/components/ui/PageHead";
import ProofSlider from "@/components/ui/ProofSlider";
import { Figure } from "@/components/ui/Provenance";
import { assumption } from "@/lib/facts";
import { pageMeta } from "@/lib/meta";
import { isLocale } from "@/lib/i18n";
import { notFound } from "next/navigation";

export const generateMetadata = pageMeta("/utsikt", {
  no: { title: "Utsikten", description: "Fra Knotten går blikket sørover langs Audna, ut Sniksfjorden og videre til åpent hav, regnet ut fra terrenget i hver grad rundt horisonten." },
  en: { title: "The view", description: "From Knotten the eye runs south along the Audna, out Sniksfjorden and on to open sea, computed from the terrain in every degree around the horizon." },
});

export default async function View({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: l } = await params;
  if (!isLocale(l)) notFound();
  const locale = l as Locale;
  const no = locale === "no";
  const photos: [string, string][] = no
    ? [["photo_fjord_wide.webp", "Utsikten sørover mot Sniksfjorden."], ["photo_fjord_farm.webp", "Gårdene, veien og elva nedenfor feltet."], ["photo_sea_summer.webp", "Sommer over fjorden."]]
    : [["photo_fjord_wide.webp", "The view south towards Sniksfjorden."], ["photo_fjord_farm.webp", "The farms, the road and the river below the field."], ["photo_sea_summer.webp", "Summer over the fjord."]];
  return (
    <>
      <Nav locale={locale} />
      <PageHead
        title={no ? "Utsikten" : "The view"}
        lede={no
          ? "Fra Knotten går blikket sørover langs Audna, ut Sniksfjorden og videre til åpent hav. Det er ikke et løfte, det er en siktlinje, regnet ut fra terrenget i hver grad rundt horisonten."
          : "From Knotten the eye runs south along the Audna, out Sniksfjorden and on to open sea. That is not a promise, it is a sight line, computed from the terrain in every degree around the horizon."}
      />
      <section className="wrap pb-12">
        <div className="grid gap-4 md:grid-cols-2">
          {photos.map(([f, cap], i) => (
            <figure key={f} className={`frame ${i === 0 ? "md:col-span-2" : ""}`}>
              <img src={`/assets/incoming/web/${f}`} alt={cap} className={`w-full object-cover ${i === 0 ? "aspect-[21/9]" : "aspect-[4/3]"}`} loading={i === 0 ? "eager" : "lazy"} />
              <figcaption className="provenance px-4 py-3">{cap} {f === "photo_sea_summer.webp" ? (no ? "Bilde fra prosjekteier; hvor det er tatt, er ikke oppgitt." : "Photo from the project owner; where it was taken is not stated.") : (no ? "Fotografert fra nabotomten, litt lavere enn feltet." : "Photographed from the neighbouring plot, a little lower than the field.")}</figcaption>
            </figure>
          ))}
        </div>
      </section>
      <section className="wrap pb-16 grid gap-x-10 gap-y-12 sm:grid-cols-3">
        <Figure a={assumption("sea_corridor_deg")} locale={locale} />
        <Figure a={assumption("open_sea_plots")} locale={locale} />
        <Figure a={assumption("lokkeheia")} locale={locale} />
      </section>
      <section className="wrap section-tight">
        <div className="panel p-6 md:p-10 grid gap-10 lg:grid-cols-[1fr_1.4fr] items-center">
          <div>
            <h2 className="display text-[clamp(34px,4.5vw,60px)]">{no ? "Fotografi mot modell" : "Photograph against model"}</h2>
            <p className="lede mt-5 max-w-[44ch]">
              {no
                ? "Naboens grillbu ligger på kanten av åsen øst for feltet. Fotografiet derfra viser gården, elvesvingen og fjorden. Modellkameraet står på samme punkt. Dra i skillet."
                : "The neighbour's grill hut sits on the edge of the hill east of the field. The photograph from there shows the farm, the river bend and the fjord. The model camera stands on the same point. Drag the divider."}
            </p>
          </div>
          <ProofSlider photo="/assets/incoming/web/view_from_grillbu.webp" model="/renders/web/grillbu_photo_match.webp" labels={[no ? "Fotografi" : "Photograph", no ? "Modell" : "Model"]} />
        </div>
      </section>
      <section className="wrap section grid gap-12 lg:grid-cols-2 items-start">
        <div>
          <h2 className="display text-[clamp(30px,4vw,48px)]">{no ? "Siktkorridoren" : "The sight corridor"}</h2>
          <p className="mt-4 text-[16px] max-w-[52ch] text-bone-2">
            {no
              ? "Hver stripe er én grad. Mørk blå: siktlinjen når vann lenger unna enn 7 km, altså åpent hav. Fra det høyeste punktet på eiendommen, i stuehøyde, er korridoren 164 til 189 grader (beregnet)."
              : "Each stripe is one degree. Dark blue: the sight line reaches water beyond 7 km, which is open sea. From the highest point of the property, at living-room height, the corridor is 164 to 189 degrees (computed)."}
          </p>
          <img src="/renders/sightline_panorama.png" alt={no ? "siktpanorama" : "sight line panorama"} className="w-full mt-6 rounded-[var(--radius)] bg-bone" />
          <p className="provenance mt-2.5">{no ? "Kartverket DTM 1 m, terrarium 20 og 80 m, refraksjon k = 1,17. Beregnet 2026-09-05." : "Kartverket DTM 1 m, terrarium 20 and 80 m, refraction k = 1.17. Computed 2026-09-05."}</p>
        </div>
        <figure className="frame">
          <img src="/renders/web/knotten_view_model.webp" alt="" className="w-full" loading="lazy" />
          <figcaption className="provenance px-4 py-3">{no ? "Fra det høyeste punktet på eiendommen, 5 m over bakken, retning 174 grader, feltet ryddet." : "From the highest point of the property, 5 m above ground, bearing 174 degrees, field cleared."}</figcaption>
        </figure>
      </section>
    </>
  );
}
