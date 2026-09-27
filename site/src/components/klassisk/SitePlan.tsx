"use client";
import { useEffect, useRef, useState } from "react";
import { PLOTS, ROW_INFO, type Plot } from "@/lib/klassisk/plots";

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

/** The site plan, redrawn from the owner's sketch: four rows along a serpentine road with max 6 % grade. */
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
    <svg ref={ref} className={`plan${reveal ? " popin" : ""}`} data-mode={mode} viewBox="0 0 820 520" preserveAspectRatio={preserve} role="img" aria-label="Skisse: fire rekker med boliger langs en vei som svinger i hårnålssvinger oppover Knotten">
      <rect width="820" height="520" fill="#F3F6F8" />
      <g className="layer layer-forest">
        <path d="M120 470c-90-100-120-260 10-360 90-70 240-90 350-30 130 70 220 240 150 350-60 95-200 130-330 100-70-16-130-30-180-60z" fill="#E4EDE7" />
        <g fill="none" stroke="#A9C2B2" strokeWidth="1">
          <path d="M160 440c-70-90-95-230 15-315 80-62 210-78 305-25 110 62 190 210 130 305-50 80-175 112-285 86-60-14-115-25-165-51z" />
          <path d="M200 410c-55-75-70-195 20-262 66-52 176-64 255-20 92 52 158 175 108 254-42 66-146 93-238 71-50-12-98-22-145-43z" />
          <path d="M240 380c-40-60-48-160 25-210 52-40 140-50 200-16 74 42 126 140 86 203-33 52-118 74-190 56-40-10-80-18-121-33z" />
          <path d="M280 350c-25-45-28-120 25-158 38-28 104-36 148-12 55 30 92 104 62 150-25 38-88 56-142 42-30-8-60-13-93-22z" />
          <path d="M320 320c-12-30-10-80 25-105 26-18 70-22 100-6 36 20 60 70 40 100-16 26-60 38-96 28-20-5-40-9-69-17z" />
        </g>
        <g fill="#3F6A52" opacity=".35">
          {[[150,150],[180,120],[130,220],[700,120],[740,200],[110,330],[200,470],[680,460],[260,60],[560,60],[420,480]].map(([cx, cy], i) => (
            <circle key={i} cx={cx} cy={cy} r={i % 3 === 0 ? 5 : 4} />
          ))}
        </g>
      </g>
      <path d="M786 0v520" stroke="#C9D3DC" strokeWidth="10" fill="none" />
      <text x="768" y="470" fontSize="10" fill="#4A5A6E" transform="rotate(-90 768 470)">Rødbergsveien</text>
      <g>
        <rect x="722" y="300" width="46" height="26" fill="#7C8A9B" /><text x="700" y="292" fontSize="10" fill="#4A5A6E">Kontorbygg</text>
        <rect x="718" y="416" width="30" height="20" fill="#7C8A9B" /><text x="694" y="452" fontSize="10" fill="#4A5A6E">Bolighus</text>
        <rect x="722" y="330" width="46" height="18" fill="none" stroke="#3F6A52" strokeWidth="1.5" strokeDasharray="3 2" />
        <rect x="684" y="416" width="26" height="20" fill="none" stroke="#3F6A52" strokeWidth="1.5" strokeDasharray="3 2" />
      </g>
      <g className="layer layer-plan">
        <path d="M780 486C720 486 690 470 660 440L660 370L170 370A55 55 0 0 1 170 260L650 260A55 55 0 0 0 650 150L165 150" fill="none" stroke="#C9D3DC" strokeWidth="16" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M780 486C720 486 690 470 660 440L660 370L170 370A55 55 0 0 1 170 260L650 260A55 55 0 0 0 650 150L165 150" fill="none" stroke="#fff" strokeWidth="1" strokeDasharray="6 8" opacity=".8" />
        <path d="M600 150V370" stroke="#8FA5BD" strokeWidth="2" strokeDasharray="3 4" fill="none" />
        <text x="606" y="230" fontSize="9" fill="#4A5A6E" transform="rotate(90 606 230)">Gangsti</text>
        <g className="plots">
          {PLOTS.map((p, i) => {
            const dim = activeRow && p.row !== activeRow;
            return (
              <g key={p.n} className={`plot${selected === p.n ? " sel" : ""}${dim ? " dim" : ""}`} data-n={p.n} style={{ animationDelay: `${i * 35}ms` }} onClick={() => onSelect?.(p.n)} role={onSelect ? "button" : undefined} tabIndex={onSelect ? 0 : undefined} onKeyDown={(e) => e.key === "Enter" && onSelect?.(p.n)}>
                <path className="sight" d={`M${p.x} ${p.y + 12}v40`} stroke="#2F5F85" strokeWidth="1" strokeDasharray="3 3" />
                <rect x={p.x - 16} y={p.y - 12} width="32" height="24" rx="3" fill="#3F6A52" />
                <path d={`M${p.x - 16} ${p.y - 12}h32`} stroke="#fff" strokeOpacity=".5" />
                {numbered && <text x={p.x} y={p.y + 4} textAnchor="middle">{p.n}</text>}
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
    </svg>
  );
}
