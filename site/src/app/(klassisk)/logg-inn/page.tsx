import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { PHOTOS } from "@/lib/klassisk/photos";
import { getSession, ROLE_LABEL } from "@/lib/auth";
import { signIn } from "@/app/(moderne)/[locale]/login/actions";
import { signOut } from "./actions";

export const metadata: Metadata = { title: "Logg inn" };

const ROLES = [["user", "Bruker"], ["admin", "Admin"], ["superadmin", "Superadmin"]] as const;

/**
 * The same preview login as the Moderne design: no password is checked, the chosen role goes into
 * the session cookie, and the portal behind it is shared by both designs.
 */
export default async function LoggInn() {
  const p = PHOTOS.sniksfjorden;
  const session = await getSession();
  return (
    <div className="login">
      <div className="box">
        <div className="crumb"><Link href="/">Forside</Link> / Logg inn</div>
        <div className="eyebrow">Prosjektportal</div>
        <h1 style={{ fontSize: "clamp(2rem,4vw,3rem)" }}>Logg inn</h1>
        {session ? (
          <>
            <p className="lede mt">Du er logget inn som {session.name || ROLE_LABEL[session.role].no} ({ROLE_LABEL[session.role].no.toLowerCase()}).</p>
            <form action={signOut} className="cta-row">
              <Link className="btn" href="/no/portal">Gå til portalen</Link>
              <button className="btn ghost" type="submit">Logg ut</button>
            </form>
          </>
        ) : (
          <>
            <p className="lede mt">For prosjektgruppen, partnere og kommunen. Tilgang gis av prosjekteier.</p>
            <div className="roles" role="radiogroup" aria-label="Rolle">
              {ROLES.map(([v, l]) => (
                <label key={v}><input type="radio" name="role" value={v} form="login" defaultChecked={v === "user"} className="sr" /><span>{l}</span></label>
              ))}
            </div>
            <form id="login" className="form" style={{ gridTemplateColumns: "1fr", marginTop: 24 }} action={signIn}>
              <input type="hidden" name="locale" value="no" />
              <label>E-post<input type="email" id="l-mail" name="email" autoComplete="username" required /></label>
              <label>Passord<input type="password" id="l-pass" name="password" autoComplete="current-password" /></label>
              <div className="cta-row" style={{ marginTop: 4 }}>
                <button className="btn" type="submit">Logg inn</button>
                <Link className="btn ghost" href="/kontakt">Be om tilgang</Link>
              </div>
              <p className="small">Forhåndsvisning: velg rolle over. Ingen passord sjekkes, og ingenting lagres utover en informasjonskapsel i sju dager.</p>
            </form>
          </>
        )}
      </div>
      <div className="side">
        <Image src={p.src} alt={p.alt} width={p.w} height={p.h} sizes="50vw" quality={80} />
        <div className="hero-cap">{p.caption}. Foto: {p.credit}, {p.license}</div>
      </div>
    </div>
  );
}
