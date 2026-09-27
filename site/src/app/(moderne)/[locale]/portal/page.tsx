import Link from "next/link";
import type { Locale } from "@/lib/i18n";
import { t } from "@/lib/i18n";
import { getSession, allowed, ROLE_LABEL } from "@/lib/auth";

export default async function Portal({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: l } = await params;
  const locale = l as Locale;
  const d = t(locale);
  const no = locale === "no";
  const session = await getSession();
  const role = session?.role ?? "public";
  const areas = [
    [no ? "Datarom" : "Data room", no ? "Dokumenter med versjon, scenarioutforsker, oppdateringer." : "Documents with versions, scenario explorer, updates.", "/investor", "investor"],
    [no ? "Energi" : "Energy", no ? "Feltet time for time, den 21. i valgt måned." : "The field hour by hour, on the 21st of the chosen month.", "/energy", "energy"],
    [no ? "Tvillingen" : "The twin", no ? "Samme modell som forsiden, bundet til data." : "The same model as the front page, bound to data.", "/twin", "twin"],
    [no ? "Beboer" : "Resident", no ? "Eget hjem: energi, dokumenter, samtykker." : "Own home: energy, documents, consents.", "/resident", "resident"],
    [no ? "Prosjekt" : "Project", no ? "Oppgaver, beslutninger, milepæler." : "Tasks, decisions, milestones.", "/project", "project"],
    [no ? "Kommune" : "Municipality", no ? "Reguleringsgrunnlag og rapportpakker." : "Regulation basis and report packs.", "/municipality", "municipality"],
    [no ? "Forskning" : "Research", no ? "Datasett med lisens og skjema for UiA." : "Datasets with licence and schema for UiA.", "/research", "research"],
    ["Admin", no ? "Interessenter, forutsetninger og roller." : "Leads, assumptions and roles.", "/admin", "admin"],
  ] as const;
  return (
    <div className="grid gap-12">
      <div className="grid gap-8 lg:grid-cols-[1fr_380px] items-start">
        <div>
          <h1 className="display text-[clamp(40px,5.5vw,72px)]">{no ? "Portalen" : "The portal"}</h1>
          <p className="lede mt-5 max-w-[52ch]">
            {no
              ? "Samme data som nettsiden, bak innlogging: datarom for investorer, prosjektarbeidsrom, rapportpakker til kommunen, forskningsdata til UiA, og senere beboerportal, energidashbord og den levende tvillingen."
              : "The same data as the website, behind a login: investor data room, project workspace, municipality report packs, UiA research data, and later the resident portal, energy dashboard and the living twin."}
          </p>
        </div>
        <div className="panel p-6">
          {session ? (
            <>
              <div className="text-[14px] text-granite">{d.auth.signedInAs}</div>
              <div className="display text-[30px] mt-1 leading-none">{session.name || ROLE_LABEL[role][locale]}</div>
              <div className="mt-1.5 text-[15px] text-granite">{ROLE_LABEL[role][locale]}</div>
              <p className="mt-4 text-[14px] text-granite">{no ? "Områdene du har tilgang til er uthevet under." : "The areas you can open are highlighted below."}</p>
            </>
          ) : (
            <>
              <div className="display text-[28px] leading-none">{no ? "Ikke logget inn" : "Not logged in"}</div>
              <p className="mt-3 text-[15px] text-granite">{no ? "Logg inn som bruker, administrator eller superadministrator for å gå gjennom portalen." : "Log in as user, administrator or super administrator to walk through the portal."}</p>
              <Link className="btn btn-amber mt-5" href={`/${locale}/login`}>{d.nav.login}</Link>
            </>
          )}
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {areas.map(([h, p, href, area]) => {
          const ok = area === "admin" ? allowed(role) : allowed(role, area);
          return (
            <Link key={href} href={`/${locale}/portal${href}`} className={`no-underline panel p-5 transition-colors hover:border-fjord ${ok ? "" : "opacity-45"}`}>
              <div className="font-medium">{h}</div>
              <div className="text-[14px] mt-1.5 text-granite">{p}</div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
