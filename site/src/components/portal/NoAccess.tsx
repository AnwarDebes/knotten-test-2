import Link from "next/link";
import { AREA_LABEL, ROLE_LABEL, type Area, type Session } from "@/lib/auth-shared";
import { CONTACT } from "@/lib/facts";
import Icon from "./Icon";

/** Shown inside the portal when a logged-in person opens an area they have not been given. */
export default function NoAccess({ locale, session, area }: { locale: "no" | "en"; session: Session; area: Area | "admin" | "superadmin" }) {
  const no = locale === "no";
  const what = area === "admin" || area === "superadmin" ? (no ? "administrasjonen" : "the administration") : AREA_LABEL[area][locale].toLowerCase();
  return (
    <div className="panel p-7 md:p-9 max-w-[62ch] grid gap-4">
      <span className="grid place-items-center w-11 h-11 rounded-full bg-bg-2 text-fjord"><Icon name="lock" /></span>
      <h1 className="display text-[30px]">{no ? "Du har ikke tilgang hit" : "You do not have access here"}</h1>
      <p className="text-[15.5px] text-ink-2">
        {no
          ? `Du er logget inn som ${session.name} (${ROLE_LABEL[session.role].no.toLowerCase()}), men kontoen din har ikke fått tilgang til ${what}. Tilgangen gis av en administrator.`
          : `You are logged in as ${session.name} (${ROLE_LABEL[session.role].en.toLowerCase()}), but your account has not been given access to ${what}. Access is given by an administrator.`}
      </p>
      <p className="text-[14.5px] text-muted">{no ? `Trenger du tilgang, skriv til ${CONTACT.email}.` : `If you need access, write to ${CONTACT.email}.`}</p>
      <div className="flex flex-wrap gap-2">
        <Link className="btn btn-sm no-underline" href={`/${locale}/portal`}>{no ? "Til portalens forside" : "To the portal home"}</Link>
        <a className="btn btn-sm btn-ghost btn-plain no-underline" href={`mailto:${CONTACT.email}?subject=${encodeURIComponent(no ? "Tilgang i Knotten-portalen" : "Access to the Knotten portal")}`}>{no ? "Be om tilgang" : "Ask for access"}</a>
      </div>
    </div>
  );
}
