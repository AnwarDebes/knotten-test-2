import type { Metadata } from "next";
import Link from "next/link";
import { peekLink } from "@/lib/server/accounts";
import { KChoosePasswordForm } from "@/components/klassisk/AuthForms";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Velg passord", robots: { index: false } };

/** Where invitation and reset links land in the Klassisk design. */
export default async function VelgPassord({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token = "" } = await searchParams;
  const link = token ? await peekLink(token) : null;
  return (
    <section className="sec">
      <div className="wrap" style={{ maxWidth: 560 }}>
        <div className="crumb"><Link href="/">Forside</Link> / <Link href="/logg-inn">Logg inn</Link> / Passord</div>
        {link ? (
          <>
            <div className="eyebrow">Prosjektportalen</div>
            <h1 style={{ fontSize: "clamp(2rem,4vw,3rem)" }}>{link.kind === "invite" ? `Velkommen, ${link.account.name.split(" ")[0]}` : "Velg nytt passord"}</h1>
            <p className="lede mt">{link.kind === "invite" ? `Du er invitert til prosjektportalen for Knotten som ${link.account.email}. Velg et passord, så er du inne.` : `For ${link.account.email}. Andre innlogginger på kontoen logges ut.`}</p>
            <div style={{ marginTop: 24 }}><KChoosePasswordForm token={token} email={link.account.email} /></div>
          </>
        ) : (
          <>
            <h1 style={{ fontSize: "clamp(2rem,4vw,3rem)" }}>Lenken virker ikke</h1>
            <p className="lede mt">Lenken er ugyldig, allerede brukt eller utløpt. Invitasjoner gjelder i sju dager og lenker for nytt passord i ett døgn. Be administratoren om en ny lenke.</p>
            <div className="cta-row"><Link className="btn" href="/logg-inn">Til innlogging</Link></div>
          </>
        )}
      </div>
    </section>
  );
}
