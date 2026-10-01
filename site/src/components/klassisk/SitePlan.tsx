"use client";
import { useEffect, useRef, useState } from "react";
import { PLOTS, ROW_INFO, type Plot } from "@/lib/klassisk/plots";
import { SITEPLAN as P } from "@/lib/klassisk/siteplan";
import { FACT, word } from "@/lib/facts";

type Props = {
  numbered?: boolean;
  selected?: number | null;
  activeRow?: Plot["row"] | "";
  onSelect?: (n: number) => void;
  onRow?: (r: Plot["row"]) => void;
  showPills?: boolean;
  preserve?: string;
  revealOnView?: boolean;
  mode: "today" | "plan";
};

const office = P.buildings.find((b) => b.id === "bld-office");
const house = P.buildings.find((b) => b.id === "bld-house");
const [stX, stY, stA] = P.labels.street;

/**
 * The site plan on the measured terrain, north up: parcel 355/10, 5 m contours, the forest, and the owner's
 * plan as the model lays it out: four rows along a road with hairpin bends and a footpath through the rows.
 */
export default function SitePlan({ numbered, selected, activeRow = "", onSelect, onRow, showPills, preserve = "xMidYMid meet", revealOnView, mode }: Props) {
  const ref = useRef<SVGSVGElement>(null);
  const [reveal, setReveal] = useState(false);
  useEffect(() => {
    if (!revealOnView || !ref.current || !("IntersectionObserver" in window)) return;
    const io = new IntersectionObserver((es) => es.forEach((e) => e.isIntersecting && (setReveal(true), io.disconnect())), { threshold: 0.35 });
    io.observe(ref.current);
    return () => io.disconnect();
  }, [revealOnView]);

  return (
    <svg ref={ref} className={`plan${reveal ? " popin" : ""}`} data-mode={mode} viewBox="0 0 820 520" preserveAspectRatio={preserve} role="img" aria-label={`Situasjonsplan på det målte terrenget: ${word(FACT.rows)} rekker med ${FACT.plots} tomter langs en vei som svinger i hårnålssvinger oppover Knotten`}>
      <rect width="820" height="520" fill="#F3F6F8" />
      <g className="layer layer-forest">
        <path d={P.forest} fill="#E4EDE7" fillRule="evenodd" />
        <g fill="none" stroke="#A9C2B2">
          {P.contours.map((c) => <path key={c.z} d={c.d} strokeWidth={c.major ? 1.1 : 0.6} />)}
        </g>
        <g fill="#3F6A52" opacity=".35">
          {P.trees.map(([cx, cy], i) => <circle key={i} cx={cx} cy={cy} r={i % 3 === 0 ? 2 : 1.5} />)}
        </g>
      </g>
      <path d={P.parcel} fill="none" stroke="#4A5A6E" strokeWidth="1.2" strokeDasharray="6 3" />
      <path d={P.yard} fill="none" stroke="#4A5A6E" strokeWidth="0.8" strokeDasharray="2 3" />
      <text x={P.labels.parcel[0]} y={P.labels.parcel[1]} fontSize="10" fill="#4A5A6E">Eiendommen 355/10</text>
      <text x={P.labels.lokkeheia[0]} y={P.labels.lokkeheia[1]} fontSize="10" fill="#4A5A6E" fontStyle="italic">Løkkeheia</text>
      <text x={P.labels.knotten[0]} y={P.labels.knotten[1]} fontSize="10" fill="#4A5A6E" fontStyle="italic">Knotten</text>
      {P.street.map((d, i) => <path key={i} d={d} stroke="#C9D3DC" strokeWidth="10" strokeLinecap="round" strokeLinejoin="round" fill="none" />)}
      <text x={stX} y={stY} fontSize="10" fill="#4A5A6E" transform={`rotate(${stA} ${stX} ${stY})`}>Rødbergsveien</text>
      <g>
        {P.buildings.filter((b) => b.status === "existing").map((b) => <path key={b.id} d={b.d} fill="#7C8A9B" />)}
        {P.buildings.filter((b) => b.status === "planned").map((b) => <path key={b.id} d={b.d} fill="none" stroke="#3F6A52" strokeWidth="1.5" strokeDasharray="3 2" />)}
        {office && <text x={office.c[0]} y={office.c[1] + 3} fontSize="9" fill="#fff" textAnchor="middle" transform={`rotate(${office.angle} ${office.c[0]} ${office.c[1]})`}>Kontorbygg</text>}
        {house && <text x={house.c[0]} y={house.c[1] + 3} fontSize="9" fill="#fff" textAnchor="middle" transform={`rotate(${house.angle} ${house.c[0]} ${house.c[1]})`}>Bolighus</text>}
      </g>
      <g className="layer layer-plan">
        <path d={P.road} fill="none" stroke="#C9D3DC" strokeWidth="9" strokeLinecap="round" strokeLinejoin="round" />
        <path d={P.road} fill="none" stroke="#fff" strokeWidth="1" strokeDasharray="6 8" opacity=".8" />
        <path d={P.path} stroke="#8FA5BD" strokeWidth="2" strokeDasharray="3 4" fill="none" />
        <text x={P.labels.gangsti[0]} y={P.labels.gangsti[1]} fontSize="9" fill="#4A5A6E" transform={`rotate(90 ${P.labels.gangsti[0]} ${P.labels.gangsti[1]})`}>Gangsti</text>
        <g className="plots">
          {PLOTS.map((p, i) => {
            const dim = activeRow && p.row !== activeRow;
            return (
              <g key={p.n} className={`plot${selected === p.n ? " sel" : ""}${dim ? " dim" : ""}`} data-n={p.n} style={{ animationDelay: `${i * 35}ms` }} onClick={() => onSelect?.(p.n)} role={onSelect ? "button" : undefined} tabIndex={onSelect ? 0 : undefined} onKeyDown={(e) => e.key === "Enter" && onSelect?.(p.n)}>
                <g transform={`translate(${p.x} ${p.y}) rotate(${p.rot})`}>
                  <path className="sight" d="M0 8.3v40" stroke="#2F5F85" strokeWidth="1" strokeDasharray="3 3" />
                  <rect x="-10.7" y="-8.3" width="21.4" height="16.5" rx="2" fill="#3F6A52" />
                  <path d="M-10.7 -8.3h21.4" stroke="#fff" strokeOpacity=".5" />
                  {numbered && <text x="0" y="3.2" textAnchor="middle">{p.n}</text>}
                </g>
              </g>
            );
          })}
        </g>
        {showPills &&
          (Object.keys(ROW_INFO) as Plot["row"][]).map((r) => (
            <g key={r} className={`rowpill${activeRow === r ? " on" : ""}`} transform={`translate(${ROW_INFO[r].x} ${ROW_INFO[r].y - 15})`} style={{ cursor: "pointer" }} onClick={() => onRow?.(r)}>
              <rect width="92" height="30" rx="15" />
              <text x="10" y="13" fontSize="10" fontWeight="700">Rekke {r}</text>
              <text x="10" y="24" fontSize="8.5" fill="#4A5A6E">{ROW_INFO[r].count} tomter</text>
            </g>
          ))}
        <text x="300" y="512" fontSize="10" fill="#2F5F85" fontStyle="italic">Siktlinje sørover mot Sniksfjorden og havet</text>
        <path d="M292 508l-6 3 6 3" fill="none" stroke="#2F5F85" strokeWidth="1" />
      </g>
      <g fill="none" stroke="#4A5A6E" strokeWidth="1">
        <path d={`M20 506h${P.scale_50m_px}M20 502v8M${20 + P.scale_50m_px} 502v8`} />
      </g>
      <text x={26 + P.scale_50m_px} y="509.5" fontSize="9" fill="#4A5A6E">50 m</text>
    </svg>
  );
}
