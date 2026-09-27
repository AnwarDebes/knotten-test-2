import Link from "next/link";
import type { Locale } from "@/lib/i18n";
import { getSession, allowed } from "@/lib/auth";
import Gate from "@/components/portal/Gate";

/** The admin area: one row of sections, then the page. Only administrators get past this layout. */
export default async function AdminLayout({ children, params }: { children: React.ReactNode; params: Promise<{ locale: string }> }) {
  const { locale: l } = await params;
  const locale = l as Locale;
  const no = locale === "no";
  const session = await getSession();
  const role = session?.role ?? "public";
  if (!allowed(role)) return <Gate locale={locale} role={role} need={["admin"]} />;
  const p = (path: string) => `/${locale}/portal/admin${path}`;
  const items: [string, string][] = [
    [p(""), no ? "Oversikt" : "Overview"],
    [p("/interessenter"), no ? "Interessenter" : "Leads"],
    [p("/tomter"), no ? "Tomter og priser" : "Plots and prices"],
    [p("/nyheter"), no ? "Nyheter" : "News"],
    ...(role === "superadmin" ? [[p("/brukere"), no ? "Brukere og roller" : "Users and roles"] as [string, string]] : []),
    [p("/innstillinger"), no ? "Innstillinger" : "Settings"],
  ];
  return (
    <div className="grid gap-8">
      <div className="flex flex-wrap items-center gap-2">
        {items.map(([href, label]) => <Link key={href} href={href} className="chip no-underline hover:bg-bone/20 transition-colors">{label}</Link>)}
      </div>
      {children}
    </div>
  );
}
