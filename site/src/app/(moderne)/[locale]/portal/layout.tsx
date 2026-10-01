import type { Metadata } from "next";
import { getRealSession, getSession, can, isAdmin, ROLE_LABEL, AREA_LABEL } from "@/lib/auth";
import { loadPlots } from "@/lib/data";
import { readStore } from "@/lib/store";
import PortalFrame, { type NavGroup } from "@/components/portal/PortalFrame";
import { initials } from "@/components/portal/ui";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const en = (await params).locale === "en";
  // the root layout adds ". Knotten" to the default; the template does the same for each portal page
  return { title: { default: en ? "Project portal" : "Prosjektportal", template: "%s. Knotten" }, robots: { index: false, follow: false } };
}

/**
 * The portal around every page: the sidebar lists only what this person can open. The pages
 * check access themselves (lib/server/portal.ts); without a session they send the visitor to
 * the login page, so this layout only draws the frame for someone who is logged in.
 */
export default async function PortalLayout({ children, params }: { children: React.ReactNode; params: Promise<{ locale: string }> }) {
  const { locale: l } = await params;
  const locale = l === "en" ? "en" : "no";
  const no = locale === "no";
  const session = await getSession();
  if (!session) return <div className="wrap py-16">{children}</div>;
  const p = (path: string) => `/${locale}/portal${path}`;
  const admin = isAdmin(session);
  const newLeads = admin ? (await readStore()).leads.filter((x) => x.status === "new" && !x.excluded && x.source !== "eksempel").length : 0;

  const areas: NavGroup["items"] = [];
  if (can(session, "investor")) areas.push({ href: p("/investor"), label: AREA_LABEL.investor[locale], icon: "briefcase" });
  if (can(session, "resident")) areas.push({ href: p("/resident"), label: AREA_LABEL.resident[locale], icon: "house" });
  if (can(session, "energy")) {
    areas.push({
      href: p("/energy"), label: AREA_LABEL.energy[locale], icon: "bolt",
      sub: [
        { href: p("/energy"), label: no ? "Dashbord" : "Dashboard", exact: true },
        { href: p("/energy/optimering"), label: no ? "Smart styring" : "Smart control" },
        { href: p("/energy/deling"), label: no ? "Energideling" : "Energy sharing" },
        { href: p("/energy/eksisterende"), label: no ? "Eksisterende bygg" : "Existing buildings" },
        { href: p("/energy/smarthjem"), label: no ? "Smarthus" : "Smart home" },
        { href: p("/twin"), label: no ? "Digital tvilling" : "Digital twin" },
      ],
    });
  }
  if (can(session, "project")) areas.push({ href: p("/project"), label: AREA_LABEL.project[locale], icon: "board" });
  areas.push({ href: p("/dokumenter"), label: no ? "Dokumenter" : "Documents", icon: "folder" });
  if (can(session, "municipality")) areas.push({ href: p("/municipality"), label: AREA_LABEL.municipality[locale], icon: "landmark" });
  if (can(session, "research")) areas.push({ href: p("/research"), label: AREA_LABEL.research[locale], icon: "flask" });

  const groups: NavGroup[] = [
    { items: [{ href: p(""), label: no ? "Oversikt" : "Overview", icon: "overview", exact: true }] },
    { title: no ? "Prosjektet" : "The project", items: areas },
  ];
  if (admin) {
    groups.push({
      title: no ? "Administrasjon" : "Administration",
      items: [
        { href: p("/admin"), label: no ? "Nøkkeltall" : "Key figures", icon: "chart", exact: true },
        { href: p("/admin/interessenter"), label: no ? "Interessenter" : "Leads", icon: "users", badge: newLeads },
        { href: p("/admin/statistikk"), label: no ? "Besøk på nettsiden" : "Website visits", icon: "pulse" },
        { href: p("/admin/tomter"), label: no ? "Tomter og priser" : "Plots and prices", icon: "map" },
        { href: p("/admin/nyheter"), label: no ? "Nyheter" : "News", icon: "news" },
        { href: p("/admin/brukere"), label: no ? "Brukere og tilgang" : "Users and access", icon: "shield" },
        { href: p("/admin/innstillinger"), label: no ? "Innstillinger" : "Settings", icon: "gear" },
        { href: p("/admin/funksjoner"), label: no ? "Funksjoner og status" : "Features and status", icon: "check" },
      ],
    });
  }
  const real = await getRealSession();
  const canPreview = !!real && isAdmin(real);
  const plots = canPreview ? (await loadPlots()).plots.map((p) => p.id) : [];
  const me = { name: session.name || session.email, email: session.email, role: session.preview ? (no ? "Forhåndsvisning" : "Preview") : `${ROLE_LABEL[session.role][locale]}${session.org ? `, ${session.org}` : ""}`, initials: initials(session.name, session.email) };
  return <PortalFrame locale={locale} groups={groups} me={me} preview={session.preview?.id} canPreview={canPreview} plots={plots}>{children}</PortalFrame>;
}
