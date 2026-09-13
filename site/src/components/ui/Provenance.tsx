import type { Locale } from "@/lib/i18n";
import type { Assumption } from "@/lib/assumptions";

export function Provenance({ source, date, provisional, locale }: { source: string; date: string; provisional?: boolean; locale: Locale }) {
  return (
    <div className="provenance">
      {source}, {date}
      {provisional ? ` (${locale === "no" ? "foreløpig" : "provisional"})` : ""}
    </div>
  );
}

/** A measured figure: the number large, its meaning under it, its source in one small line. */
export function Figure({ a, locale, size = "lg" }: { a: Assumption; locale: Locale; size?: "lg" | "md" }) {
  const v = a.value.toLocaleString(locale === "no" ? "nb-NO" : "en-GB");
  return (
    <div>
      <div className={`num ${size === "lg" ? "text-[56px] md:text-[72px]" : "text-[38px]"} leading-none`}>
        {v}<span className="text-[0.38em] ml-2 font-body font-normal opacity-60">{a.unit}</span>
      </div>
      <div className="mt-2 text-[15.5px]">{a.label[locale]}</div>
      <Provenance source={a.source} date={a.date} provisional={a.provisional} locale={locale} />
    </div>
  );
}
