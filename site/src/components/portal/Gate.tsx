import Link from "next/link";
import type { Locale } from "@/lib/i18n";
import { ROLE_LABEL, type Role } from "@/lib/auth-shared";

export default function Gate({ locale, role, need }: { locale: Locale; role: Role; need: string[] }) {
  const no = locale === "no";
  const adminOnly = need.length === 0 || need.includes("admin");
  return (
    <div className="panel p-7 max-w-[56ch]">
      <div className="display text-[30px]">{role === "public" ? (no ? "Logg inn for å se dette" : "Log in to see this") : (no ? "Ingen tilgang" : "No access")}</div>
      <p className="mt-3 text-[15px] text-granite">
        {role === "public"
          ? (no ? "Denne delen av portalen ligger bak innlogging." : "This part of the portal sits behind a login.")
          : adminOnly
            ? (no ? `Denne siden er for administratorer. Du er logget inn som ${ROLE_LABEL[role][locale].toLowerCase()}.` : `This page is for administrators. You are logged in as ${ROLE_LABEL[role][locale].toLowerCase()}.`)
            : (no ? `Du er logget inn som ${ROLE_LABEL[role][locale].toLowerCase()}.` : `You are logged in as ${ROLE_LABEL[role][locale].toLowerCase()}.`)}
      </p>
      <Link className="btn mt-5" href={`/${locale}/login`}>{role === "public" ? (no ? "Logg inn" : "Log in") : (no ? "Bytt bruker" : "Switch user")}</Link>
    </div>
  );
}
