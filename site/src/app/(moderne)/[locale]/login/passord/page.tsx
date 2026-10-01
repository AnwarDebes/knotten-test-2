import type { Metadata } from "next";
import Link from "next/link";
import type { Locale } from "@/lib/i18n";
import { peekLink } from "@/lib/server/accounts";
import Logo from "@/components/ui/Logo";
import { ChoosePasswordForm } from "@/components/auth/AuthForms";
import { isLocale } from "@/lib/i18n";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";
export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  return { title: (await params).locale === "en" ? "Choose a password" : "Velg passord", robots: { index: false } };
}

/** Where invitation and reset links land: the person chooses a password and is let in. */
export default async function ChoosePassword({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ token?: string }> }) {
  const { locale: l } = await params;
  if (!isLocale(l)) notFound();
  const { token = "" } = await searchParams;
  const locale = (l === "en" ? "en" : "no") as Locale;
  const no = locale === "no";
  const link = token ? await peekLink(token) : null;
  return (
    <section className="min-h-[calc(100svh-37px)] grid place-items-center px-6 py-12">
      <div className="w-full max-w-[460px] grid gap-7">
        <div className="flex items-center justify-between gap-4">
          <Link href={`/${locale}`} className="no-underline" aria-label="Knotten"><Logo height={48} /></Link>
          <Link href={`/${no ? "en" : "no"}/login/passord${token ? `?token=${encodeURIComponent(token)}` : ""}`} hrefLang={no ? "en" : "no"} lang={no ? "en" : "no"} className="text-[14px] text-muted hover:text-ink no-underline">{no ? "English" : "Norsk"}</Link>
        </div>
        {link ? (
          <>
            <div>
              <h1 className="display text-[clamp(32px,4vw,44px)]">{link.kind === "invite" ? (no ? `Velkommen, ${link.account.name.split(" ")[0]}` : `Welcome, ${link.account.name.split(" ")[0]}`) : (no ? "Velg nytt passord" : "Choose a new password")}</h1>
              <p className="mt-3 text-[15.5px] text-ink-2">
                {link.kind === "invite"
                  ? (no ? `Du er invitert til prosjektportalen for Knotten som ${link.account.email}. Velg et passord, så er du inne.` : `You are invited to the Knotten project portal as ${link.account.email}. Choose a password and you are in.`)
                  : (no ? `For ${link.account.email}. Andre innlogginger på kontoen logges ut.` : `For ${link.account.email}. Other sessions on the account are logged out.`)}
              </p>
            </div>
            <div className="panel p-6 md:p-7"><ChoosePasswordForm locale={locale} token={token} email={link.account.email} /></div>
          </>
        ) : (
          <div className="panel p-6 md:p-7 grid gap-4">
            <h1 className="display text-[30px]">{no ? "Lenken virker ikke" : "The link does not work"}</h1>
            <p className="text-[15.5px] text-ink-2">{no ? "Lenken er ugyldig, allerede brukt eller utløpt. Invitasjoner gjelder i sju dager og lenker for nytt passord i ett døgn. Be administratoren om en ny lenke." : "The link is invalid, already used or expired. Invitations last seven days and password links one day. Ask the administrator for a new link."}</p>
            <Link className="btn btn-sm no-underline justify-self-start" href={`/${locale}/login`}>{no ? "Til innlogging" : "To log in"}</Link>
          </div>
        )}
      </div>
    </section>
  );
}
