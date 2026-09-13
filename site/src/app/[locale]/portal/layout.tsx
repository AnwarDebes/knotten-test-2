import Link from "next/link";
import type { Locale } from "@/lib/i18n";
import { t } from "@/lib/i18n";
import { getSession, allowed, ROLE_LABEL } from "@/lib/auth";
import Nav from "@/components/ui/Nav";
import { signOut } from "../login/actions";

export default async function PortalLayout({ children, params }: { children: React.ReactNode; params: Promise<{ locale: string }> }) {
  const { locale: l } = await params;
  const locale = l as Locale;
  const d = t(locale);
  const no = locale === "no";
  const session = await getSession();
  const role = session?.role ?? "public";
  const p = (path: string) => `/${locale}/portal${path}`;
  const items: { href: string; label: string; ok: boolean }[] = [
    { href: p("/investor"), label: no ? "Datarom" : "Data room", ok: allowed(role, "investor") },
    { href: p("/resident"), label: no ? "Beboer" : "Resident", ok: allowed(role, "resident") },
    { href: p("/energy"), label: no ? "Energi" : "Energy", ok: allowed(role, "energy") },
    { href: p("/twin"), label: no ? "Tvilling" : "Twin", ok: allowed(role, "twin") },
    { href: p("/project"), label: no ? "Prosjekt" : "Project", ok: allowed(role, "project") },
    { href: p("/municipality"), label: no ? "Kommune" : "Municipality", ok: allowed(role, "municipality") },
    { href: p("/research"), label: no ? "Forskning" : "Research", ok: allowed(role, "research") },
    { href: p("/admin"), label: "Admin", ok: allowed(role) },
  ];
  return (
    <>
      <Nav locale={locale} />
      <div className="wrap pt-6">
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 py-3 border-b line text-[14px]">
          <Link href={p("")} className="font-medium no-underline">{d.nav.portal}</Link>
          {items.map((it) => (
            <Link key={it.href} href={it.href} className={`no-underline hover:underline ${it.ok ? "" : "opacity-40"}`}>{it.label}</Link>
          ))}
          <span className="ml-auto flex items-center gap-2">
            {session && <span className="w-2 h-2 rounded-full bg-amber" />}
            <span>{session ? `${session.name || ROLE_LABEL[role][locale]} (${ROLE_LABEL[role][locale]})` : ROLE_LABEL.public[locale]}</span>
          </span>
          {session ? (
            <form action={signOut}><input type="hidden" name="locale" value={locale} /><button className="underline">{d.nav.logout}</button></form>
          ) : (
            <Link href={`/${locale}/login`} className="underline">{d.nav.login}</Link>
          )}
        </div>
      </div>
      <div className="wrap py-10 md:py-14">{children}</div>
    </>
  );
}
