import type { Metadata } from "next";
import PageHead from "@/components/klassisk/PageHead";
import Reveal from "@/components/klassisk/Reveal";
import { Src } from "@/components/klassisk/Source";
import { FIGURES } from "@/lib/klassisk/sources";

export const metadata: Metadata = { title: "Kilder og forutsetninger" };

const TAG: Record<string, string> = { Fastsatt: "tag green", Verifisert: "tag green", Beregnet: "tag blue", Foreløpig: "tag" };

export default function Kilder() {
  return (
    <>
      <PageHead title="Kilder og forutsetninger" crumb="Kilder og forutsetninger">
        <p>Én rad per tall som brukes på nettsiden: hva det er, verdien, hvor den kommer fra, hvem som eier den og hvor sikker den er. Et tall som ikke står her, står ikke på siden.</p>
      </PageHead>
      <section className="sec" style={{ paddingTop: 32 }}>
        <div className="wrap">
          <Reveal className="tbl">
            <table>
              <thead><tr><th>Hva</th><th>Verdi</th><th>Enhet</th><th>Status</th><th>Ansvarlig</th><th>Kilde</th></tr></thead>
              <tbody>
                {FIGURES.map((f) => (
                  <tr key={f.what}>
                    <td>{f.what}</td>
                    <td>{f.value}</td>
                    <td>{f.unit}</td>
                    <td><span className={TAG[f.status]} style={{ marginBottom: 0 }}>{f.status}</span></td>
                    <td>{f.owner}</td>
                    <td><Src id={f.src} label="Vis" /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Reveal>
          <div className="cols3" style={{ marginTop: 40 }}>
            <div><h3>Fastsatt</h3><p>Målt eller vedtatt. Eiendomskart, byggene som finnes.</p></div>
            <div><h3>Foreløpig</h3><p>Anslag fra arbeidsdokumenter. Avrundes og får et spenn. Byttes ut når bedre tall finnes.</p></div>
            <div><h3>Verifisert</h3><p>Sjekket mot offentlige kilder på nett, med lenke og dato for når vi leste dem.</p></div>
          </div>
        </div>
      </section>
    </>
  );
}
