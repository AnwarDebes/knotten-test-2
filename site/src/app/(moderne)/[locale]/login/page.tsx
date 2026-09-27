import Link from "next/link";
import type { Locale } from "@/lib/i18n";
import { t } from "@/lib/i18n";
import { getSession, ROLE_LABEL } from "@/lib/auth";
import Nav from "@/components/ui/Nav";
import { Mark } from "@/components/ui/Mark";
import { signIn, signOut } from "./actions";

export default async function Login({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: l } = await params;
  const locale = l as Locale;
  const d = t(locale);
  const A = d.auth;
  const session = await getSession();
  const roles = ["user", "admin", "superadmin"] as const;

  return (
    <>
      <Nav locale={locale} />
      <section className="wrap section grid gap-12 lg:grid-cols-[1fr_440px] items-start">
        <div>
          <h1 className="display text-[clamp(44px,6vw,84px)]">{A.title}</h1>
          <p className="lede mt-6 max-w-[48ch]">{A.sub}</p>
          <ul className="mt-10 grid gap-4 max-w-[48ch] text-[15px]">
            {roles.map((r) => (
              <li key={r} className="grid grid-cols-[132px_1fr] gap-4 items-baseline">
                <span className="font-medium">{A.roles[r]}</span>
                <span className="text-granite">{A.roleHelp[r]}</span>
              </li>
            ))}
          </ul>
        </div>

        {session ? (
          <div className="panel p-7">
            <div className="flex items-center gap-2.5"><Mark size={22} /><span className="text-[15px]">{A.signedInAs}</span></div>
            <div className="display text-[34px] mt-4 leading-none">{session.name || ROLE_LABEL[session.role][locale]}</div>
            <div className="mt-2 text-granite text-[15px]">{ROLE_LABEL[session.role][locale]}{session.email ? `, ${session.email}` : ""}</div>
            <div className="mt-7 flex flex-wrap gap-3">
              <Link className="btn btn-amber" href={`/${locale}/portal`}>{A.goPortal}</Link>
              <form action={signOut}><input type="hidden" name="locale" value={locale} /><button className="btn btn-ghost" type="submit">{A.signOut}</button></form>
            </div>
          </div>
        ) : (
          <form action={signIn} className="panel p-7 grid gap-5">
            <input type="hidden" name="locale" value={locale} />
            <label className="grid gap-1.5 text-[14px]">{A.email}<input className="input" name="email" type="email" autoComplete="email" placeholder="navn@firma.no" required /></label>
            <label className="grid gap-1.5 text-[14px]">{A.password}<input className="input" name="password" type="password" autoComplete="current-password" placeholder="••••••••" /></label>
            <fieldset className="grid gap-2 text-[14px]">
              <legend className="mb-1.5">{A.role}</legend>
              <div className="seg seg-light w-full" role="radiogroup">
                {roles.map((r) => (
                  <label key={r} className="flex-1">
                    <input type="radio" name="role" value={r} defaultChecked={r === "user"} className="peer sr-only" />
                    <span className="block text-center px-3 py-2 rounded-full cursor-pointer peer-checked:bg-bone peer-checked:text-bg transition-colors">{A.roles[r]}</span>
                  </label>
                ))}
              </div>
            </fieldset>
            <button className="btn btn-amber mt-1" type="submit">{A.submit}</button>
            <p className="provenance">{A.demo}</p>
          </form>
        )}
      </section>
    </>
  );
}
