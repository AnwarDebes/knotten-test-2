import Image from "next/image";
import Link from "next/link";
import { PHOTOS } from "@/lib/klassisk/photos";
import { Src } from "./Source";
import CountUp from "./CountUp";
import { FACT } from "@/lib/facts";

/**
 * Hero: text left, the real view photo right at its native resolution (never upscaled),
 * with the two summer photos tucked in as small cards.
 */
export default function Hero() {
  const v = PHOTOS.view;
  const s1 = PHOTOS.sniksfjorden;
  const s2 = PHOTOS.spangereid;
  return (
    <section className="hero2" id="hero" data-journey="hero">
      <div className="wrap hero2-grid">
        <div className="hero2-text">
          <div className="kicker rise">Rødberg i Lindesnes, ved Audna elvas utløp</div>
          <h1 className="rise d1">Et boligfelt som ser havet, og som skal klare seg mest mulig selv.</h1>
          <p className="lede rise d2">
            {`Rundt ${FACT.plots} tomter på Knotten, i rekker oppover en skogkledd knaus over Sniksfjorden.`} Ønsket er sjøutsikt fra alle tomtene, men det er ikke sikkert at det går fra alle. Feltet planlegges fra første dag med lavt energibehov, egen energiproduksjon, lagring og robusthet ved strømbrudd. Alle tall vi viser kan spores til sin kilde.
          </p>
          <div className="cta-row rise d3">
            <Link className="btn" href="/tomtene">Se tomtene</Link>
            <Link className="btn ghost" href="/kontakt">Meld interesse</Link>
          </div>
        </div>
        <div className="hero2-media rise d1">
          <figure className="hero2-main">
            <Image src={v.src} alt={v.alt} width={v.w} height={v.h} priority sizes="(max-width: 900px) 100vw, 46vw" quality={88} />
            <div className="pin" style={{ left: "60%", top: "34%" }}><i />Sikt mot åpent hav</div>
            <figcaption>Utsikten mot Sniksfjorden, fra nabotomten litt nedenfor feltet <Src id="foto" /></figcaption>
          </figure>
          <figure className="hero2-small a"><Image src={s1.src} alt={s1.alt} width={s1.w} height={s1.h} sizes="260px" quality={88} /><figcaption>Sniksfjorden</figcaption></figure>
          <figure className="hero2-small b"><Image src="/img/spangereid-card.jpg" alt={s2.alt} width={720} height={886} sizes="200px" quality={88} /><figcaption>Spangereid</figcaption></figure>
          <p className="hero2-credit small">Små bilder: Rolfsteinar (CC BY-SA 3.0) og Flums (CC BY-SA 4.0), Wikimedia Commons</p>
        </div>
      </div>
      <div className="wrap">
        <div className="facts">
          <div className="fact"><CountUp value={FACT.plots} prefix="Rundt " /><span>tomter, ønsket er sjøutsikt fra alle <Src id="sigve30" /></span></div>
          <div className="fact"><CountUp value={FACT.parcel_m2} suffix=" m²" /><span>{`samlet for eiendommene gnr ${FACT.gnr} bnr ${FACT.bnr} og ${FACT.bnr_extra}`} <Src id="areal" /></span></div>
          <div className="fact"><CountUp value={FACT.road_grade_pct} prefix="Maks " suffix=" %" /><span>stigning på veiene i feltet <Src id="vei" /></span></div>
          <div className="fact"><b>Regulering</b><span>ikke vedtatt ennå. Prosjektet starter før reguleringsplan <Src id="regulering" /></span></div>
        </div>
      </div>
    </section>
  );
}
