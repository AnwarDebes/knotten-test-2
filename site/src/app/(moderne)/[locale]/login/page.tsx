import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import type { Locale } from "@/lib/i18n";
import { getSession, ROLE_LABEL, safeNext } from "@/lib/auth";
import { loadAuth, needsSetup, setupCode } from "@/lib/server/accounts";
import { CONTACT } from "@/lib/facts";
import Logo from "@/components/ui/Logo";
import { LoginForm, SetupForm } from "@/components/auth/AuthForms";
import ClearWho from "@/components/auth/ClearWho";
import { logout } from "./actions";
import { isLocale } from "@/lib/i18n";

export const dynamic = "force-dynamic";
export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  return { title: (await params).locale === "en" ? "Log in" : "Logg inn", robots: { index: false } };
}

/** The way into the project portal: one calm screen, the view from Knotten on one side, the form on the other. */
export default async function Login({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ next?: string }> }) {
  const { locale: l } = await params;
  if (!isLocale(l)) notFound();
  const { next } = await searchParams;
  const locale = (l === "en" ? "en" : "no") as Locale;
  const no = locale === "no";
  const other = no ? "en" : "no";
  const session = await getSession();
  if (session && next) redirect(safeNext(next, locale));
  const firstRun = !session && (await needsSetup());
  const code = firstRun ? await setupCode() : undefined;
  const owner = firstRun ? (await loadAuth()).accounts.find((a) => a.role === "superadmin") : undefined;

  return (
    <section className="grid lg:grid-cols-[1.08fr_1fr] min-h-[calc(100svh-37px)]">
      {!session && <ClearWho />}
      <div className="relative hidden lg:block overflow-hidden">
        <Image src="/img/view.jpg" alt={no ? "Utsikten fra Knotten mot Sniksfjorden og havet" : "The view from Knotten towards Sniksfjorden and the sea"} fill priority sizes="55vw" className="object-cover" />
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(23,40,58,.12)_0%,rgba(23,40,58,.05)_45%,rgba(23,40,58,.72)_100%)]" />
        <div className="absolute left-10 right-10 bottom-10 text-white max-w-[46ch]">
          <div className="text-[13px] uppercase tracking-[.14em] opacity-80">{no ? "Prosjektportalen" : "The project portal"}</div>
          <p className="display text-[clamp(30px,2.6vw,42px)] mt-3 leading-[1.02]">{no ? "Datarom, prosjektrom, energidata og rapporter, samlet på ett sted." : "Data room, project room, energy data and reports, in one place."}</p>
          <p className="mt-4 text-[15px] opacity-85">{no ? "For prosjektgruppen, investorer, kommunen, forskere og beboere. Tilgang gis av prosjekteier." : "For the project group, investors, the municipality, researchers and residents. Access is given by the project owner."}</p>
        </div>
      </div>

      <div className="flex flex-col bg-[var(--bg)]">
        <header className="flex items-center justify-between gap-4 px-6 md:px-12 pt-6">
          <Link href={`/${locale}`} className="no-underline" aria-label="Knotten"><Logo height={46} /></Link>
          <div className="flex items-center gap-5">
            <Link href={`/${other}/login${next ? `?next=${encodeURIComponent(next.replace(/^\/(no|en)(?=\/|$)/, `/${other}`))}` : ""}`} hrefLang={other} lang={other} className="text-[14px] text-muted hover:text-ink no-underline">{no ? "English" : "Norsk"}</Link>
            <Link href={`/${locale}`} className="text-[14px] text-muted hover:text-ink no-underline">{no ? "Til nettsiden" : "Back to the website"}</Link>
          </div>
        </header>

        <div className="flex-1 grid place-items-center px-6 md:px-12 py-12">
          <div className="w-full max-w-[440px]">
            {session ? (
              <div className="grid gap-6">
                <div>
                  <h1 className="display text-[clamp(34px,4vw,46px)]">{no ? "Du er logget inn" : "You are logged in"}</h1>
                  <p className="mt-3 text-[16px] text-ink-2">{session.name}, {ROLE_LABEL[session.role][locale].toLowerCase()}. {session.email}</p>
                </div>
                <div className="flex flex-wrap gap-3">
                  <Link className="btn no-underline" href={`/${locale}/portal`}>{no ? "Gå til portalen" : "Go to the portal"}</Link>
                  <form action={logout}><input type="hidden" name="to" value={`/${locale}/login`} /><button className="btn btn-ghost btn-plain" type="submit">{no ? "Logg ut" : "Log out"}</button></form>
                </div>
              </div>
            ) : firstRun ? (
              <div className="grid gap-7">
                <div>
                  <div className="chip chip-amber">{no ? "Første oppsett" : "First-time setup"}</div>
                  <h1 className="display text-[clamp(32px,3.8vw,44px)] mt-4">{no ? "Opprett superadministrator" : "Create the super administrator"}</h1>
                  <p className="mt-3 text-[15.5px] text-ink-2">{no ? "Portalen har ingen administrator med passord ennå. Den som setter opp nettstedet, oppretter den første kontoen her. Etterpå inviteres resten fra portalen." : "The portal has no administrator with a password yet. Whoever sets up the site creates the first account here. Everyone else is then invited from the portal."}</p>
                </div>
                <SetupForm locale={locale} email={owner?.email ?? CONTACT.email} name={owner?.name ?? CONTACT.name} devCode={process.env.NODE_ENV !== "production" ? code : undefined} />
              </div>
            ) : (
              <div className="grid gap-7">
                <div>
                  <h1 className="display text-[clamp(36px,4.2vw,50px)]">{no ? "Logg inn" : "Log in"}</h1>
                  <p className="mt-3 text-[15.5px] text-ink-2">{no ? "Prosjektportalen for Knotten. Bruk e-postadressen du ble invitert med." : "The project portal for Knotten. Use the email address you were invited with."}</p>
                </div>
                <LoginForm locale={locale} next={next} />
                <div className="hairline" />
                <p className="text-[14px] text-muted">
                  {no ? "Har du ikke tilgang ennå? " : "No access yet? "}
                  <Link href={`/${locale}/kontakt`} className="text-fjord">{no ? "Be om tilgang" : "Request access"}</Link>
                  {no ? `, eller skriv til ${CONTACT.email}.` : `, or write to ${CONTACT.email}.`}
                </p>
              </div>
            )}
          </div>
        </div>
        <p className="px-6 md:px-12 pb-6 text-[12.5px] text-muted">{no ? "Innloggingen bruker informasjonskapsler for å holde deg innlogget, ikke for sporing. Se " : "Logging in uses cookies to keep you signed in, not for tracking. See "}<Link href={`/${locale}/personvern`}>{no ? "personvern" : "privacy"}</Link>.</p>
      </div>
    </section>
  );
}
