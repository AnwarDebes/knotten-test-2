import { AREA_LABEL, ROLE_LABEL, can } from "@/lib/auth";
import { AREAS } from "@/lib/auth-shared";
import { pageTitle, portalPage } from "@/lib/server/portal";
import { findById, loadAuth } from "@/lib/server/accounts";
import { ChangePasswordForm, ProfileForm } from "@/components/auth/AuthForms";
import { logoutEverywhere } from "@/app/(moderne)/[locale]/login/actions";
import { PageHead, Section, when } from "@/components/portal/ui";
import { logText } from "@/lib/logText";

export const dynamic = "force-dynamic";
export const generateMetadata = pageTitle("Min konto", "My account");

/** The person's own account: name, password, the areas they have, and a way to log out everywhere. */
export default async function Account({ params }: { params: Promise<{ locale: string }> }) {
  const { locale, no, session } = await portalPage(params, "/konto", "any");
  const account = findById(await loadAuth(), session.id);
  const areas = AREAS.filter((a) => can(session, a));
  const mine = (await loadAuth()).audit.filter((x) => x.who === session.email).slice(0, 8);
  return (
    <>
      <PageHead eyebrow={session.email} title={no ? "Min konto" : "My account"} lede={no ? "Navn, passord og tilganger. Passordet lagres bare som en kryptografisk hash; ingen, heller ikke administratorene, kan se det." : "Name, password and access. The password is stored only as a cryptographic hash; nobody, not even the administrators, can see it."} />
      <div className="grid gap-5 lg:grid-cols-2 items-start">
        <Section title={no ? "Profil" : "Profile"}>
          <div className="panel p-5 md:p-6"><ProfileForm locale={locale} name={session.name} org={session.org} /></div>
        </Section>
        <Section title={no ? "Bytt passord" : "Change password"} sub={no ? "Andre innlogginger på kontoen logges ut når passordet byttes." : "Other sessions on the account are logged out when the password changes."}>
          <div className="panel p-5 md:p-6"><ChangePasswordForm locale={locale} email={session.email} /></div>
        </Section>
      </div>
      <div className="grid gap-5 lg:grid-cols-2 items-start">
        <Section title={no ? "Tilgang" : "Access"}>
          <div className="panel p-5 md:p-6 grid gap-3 text-[14.5px]">
            <div className="flex justify-between gap-3"><span className="text-muted">{no ? "Rolle" : "Role"}</span><span className="font-medium">{ROLE_LABEL[session.role][locale]}</span></div>
            <div className="flex justify-between gap-3"><span className="text-muted">{no ? "Områder" : "Areas"}</span><span className="text-right">{areas.map((a) => AREA_LABEL[a][locale]).join(", ") || (no ? "ingen ennå" : "none yet")}</span></div>
            {session.plot && <div className="flex justify-between gap-3"><span className="text-muted">{no ? "Tomt" : "Plot"}</span><span>{Number(session.plot.slice(5))}</span></div>}
            <div className="flex justify-between gap-3"><span className="text-muted">{no ? "Konto opprettet" : "Account created"}</span><span>{when(account?.created, locale, false)}</span></div>
            <div className="flex justify-between gap-3"><span className="text-muted">{no ? "Innlogginger" : "Logins"}</span><span>{account?.logins ?? 0}{account?.last_login ? `, ${no ? "sist" : "last"} ${when(account.last_login, locale)}` : ""}</span></div>
            <p className="text-[13px] text-muted">{no ? "Trenger du tilgang til mer, spør en administrator." : "If you need access to more, ask an administrator."}</p>
          </div>
        </Section>
        <Section title={no ? "Innlogginger" : "Sessions"}>
          <div className="panel p-5 md:p-6 grid gap-3">
            <p className="text-[14.5px] text-ink-2">{no ? "Har du logget inn på en maskin du ikke bruker lenger, eller mistet en telefon? Logg ut overalt, så må alle enheter logge inn på nytt." : "Logged in on a machine you no longer use, or lost a phone? Log out everywhere, and every device must log in again."}</p>
            <form action={logoutEverywhere}>
              <input type="hidden" name="to" value={`/${locale}/login`} />
              <button className="btn btn-sm btn-ghost btn-plain">{no ? "Logg ut på alle enheter" : "Log out on all devices"}</button>
            </form>
            {mine.length > 0 && (
              <div className="grid gap-1 text-[13px] mt-2">
                <div className="text-muted">{no ? "Siste hendelser på kontoen" : "Recent events on the account"}</div>
                {mine.map((x, i) => <div key={i} className="flex justify-between gap-3"><span>{logText(x.what, locale)}</span><span className="text-muted whitespace-nowrap">{when(x.at, locale)}</span></div>)}
              </div>
            )}
          </div>
        </Section>
      </div>
    </>
  );
}
