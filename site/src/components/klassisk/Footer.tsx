import Link from "next/link";
import Logo from "./Logo";
import OwnerLogo from "./OwnerLogo";

export default function Footer() {
  return (
    <footer className="site">
      <div className="wrap">
        <div>
          <Link className="flogo" href="/">
            <Logo size={64} light />
          </Link>
          <p className="note">
            Norges mest energivennlige boligfelt, under planlegging på Rødberg i Lindesnes. Alle tall på siden er foreløpige anslag som kan spores til dokumenterte forutsetninger. Ingenting her er et tilbud.
          </p>
        </div>
        <div>
          <h4>Prosjektet</h4>
          <Link href="/">Forside</Link>
          <Link href="/prosjektet">Om prosjektet</Link>
          <Link href="/tomtene">Tomtene</Link>
          <Link href="/kart">Kart og terreng</Link>
          <Link href="/energi">Energi og teknologi</Link>
          <Link href="/eksisterende-bygg">Eksisterende bygg</Link>
          <Link href="/galleri">Bilder</Link>
        </div>
        <div>
          <h4>For deg</h4>
          <Link href="/investorer">Investorer og kommune</Link>
          <Link href="/dokumentbank">Dokumentbank</Link>
          <Link href="/kilder">Kilder og forutsetninger</Link>
          <Link href="/kontakt">Meld interesse</Link>
          <Link href="/logg-inn">Logg inn</Link>
        </div>
        <div>
          <h4>Kontakt</h4>
          <span style={{ display: "block", padding: "4px 0 8px", fontSize: ".95rem" }}>Prosjekteier: Sigve Simonsen AS</span>
          <a href="mailto:sigve.simonsen@hotmail.com">sigve.simonsen@hotmail.com</a>
          <a href="tel:+4795495152">954 95 152</a>
          <span style={{ display: "block", padding: "4px 0", fontSize: ".95rem" }}>Rødbergsveien 121, 4520 Lindesnes</span>
        </div>
        <div className="bottom">
          <OwnerLogo light />
          <span>Kartgrunnlag: Kartverket og Norkart. Områdebilder: Wikimedia Commons, CC BY-SA 3.0 og 4.0</span>
          <Link href="/personvern">Personvern</Link>
        </div>
      </div>
    </footer>
  );
}
