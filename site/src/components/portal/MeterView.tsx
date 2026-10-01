import { beforeAfter, type Building } from "@/lib/server/records";
import { Bars } from "./charts";

const MONTHS_NO = ["jan", "feb", "mar", "apr", "mai", "jun", "jul", "aug", "sep", "okt", "nov", "des"];
const MONTHS_EN = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/**
 * Measured consumption for one of the buildings that stand today: the months as bars, the years
 * side by side, and the effect of each upgrade as twelve months after against twelve before.
 * Used in the portal and, when the owner allows it, on the public pages.
 */
export function MeterView({ b, locale }: { b: Building; locale: "no" | "en" }) {
  const no = locale === "no";
  const names = no ? MONTHS_NO : MONTHS_EN;
  const nf = (v: number) => Math.round(v).toLocaleString(no ? "nb-NO" : "en-GB");
  const recent = b.readings.slice(-36);
  const upgradeMonths = new Set(b.upgrades.map((u) => u.date.slice(0, 7)));
  const years = [...new Set(b.readings.map((r) => r.month.slice(0, 4)))].sort();
  const perYear = years.map((y) => {
    const rows = b.readings.filter((r) => r.month.startsWith(y));
    return { year: y, months: rows.length, kwh: rows.reduce((a, r) => a + r.kwh, 0) };
  });
  return (
    <div className="grid gap-4">
      <Bars
        data={recent.map((r) => ({ label: `${names[Number(r.month.slice(5, 7)) - 1]} ${r.month.slice(2, 4)}`, value: r.kwh, tone: upgradeMonths.has(r.month) ? "amber" : "fjord", title: `${names[Number(r.month.slice(5, 7)) - 1]} ${r.month.slice(0, 4)}: ${nf(r.kwh)} kWh${upgradeMonths.has(r.month) ? (no ? " (tiltak denne måneden)" : " (upgrade this month)") : ""}` }))}
        unit="kWh"
        every={recent.length > 18 ? 3 : 1}
        ariaLabel={no ? `Månedlig forbruk, ${b.name.no}` : `Monthly consumption, ${b.name.en}`}
      />
      <div className="grid gap-4 md:grid-cols-2">
        <table className="table table-tight">
          <thead><tr><th>{no ? "År" : "Year"}</th><th className="n">kWh</th>{b.area_m2 ? <th className="n">kWh/m²</th> : null}<th className="n">{no ? "Måneder" : "Months"}</th></tr></thead>
          <tbody>
            {perYear.map((y) => (
              <tr key={y.year}><td>{y.year}</td><td className="n">{nf(y.kwh)}</td>{b.area_m2 ? <td className="n">{y.months === 12 ? nf(y.kwh / b.area_m2) : ""}</td> : null}<td className="n">{y.months}{y.months < 12 ? (no ? " (delvis)" : " (partial)") : ""}</td></tr>
            ))}
          </tbody>
        </table>
        <div className="grid gap-2 content-start">
          {b.upgrades.length === 0 && <p className="text-[14px] text-muted">{no ? "Ingen tiltak registrert. Når et tiltak legges inn med dato, vises før og etter her." : "No upgrades registered. When an upgrade is added with a date, before and after shows here."}</p>}
          {b.upgrades.map((u) => {
            const ba = beforeAfter(b.readings, u.date);
            return (
              <div key={u.id} className="rounded-[var(--radius)] border line p-3 text-[14px] bg-white">
                <div className="flex flex-wrap justify-between gap-2"><span className="font-medium">{u.title}</span><span className="text-muted text-[12.5px]">{u.date}{u.cost_nok ? ` · ${nf(u.cost_nok)} kr` : ""}</span></div>
                {u.detail && <p className="text-[13.5px] text-ink-2 mt-1">{u.detail}</p>}
                {ba ? (
                  <div className="mt-2 flex flex-wrap items-baseline gap-x-4 gap-y-1">
                    <span className={`num text-[22px] ${ba.change_pct <= 0 ? "text-pine" : "text-amber-ink"}`}>{ba.change_pct > 0 ? "+" : ""}{ba.change_pct.toFixed(0)} %</span>
                    <span className="text-[13px] text-muted">{no ? `${nf(ba.after)} kWh de ${ba.pairs} månedene etter mot ${nf(ba.before)} kWh før. Ikke temperaturkorrigert.` : `${nf(ba.after)} kWh in the ${ba.pairs} months after against ${nf(ba.before)} kWh before. Not weather-corrected.`}</span>
                  </div>
                ) : (
                  <p className="text-[13px] text-muted mt-1">{no ? "Før og etter vises når det finnes målinger på begge sider av datoen." : "Before and after shows once there are readings on both sides of the date."}</p>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
