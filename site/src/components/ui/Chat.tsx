"use client";
import { useEffect, useRef, useState } from "react";
import type { Locale } from "@/lib/i18n";

type Msg = { from: "you" | "ai"; text: string };

/** The mark of Knotten AI: a small sun that turns slowly, amber into fjord blue. */
export function Orb({ size = 22 }: { size?: number }) {
  return (
    <span className="orb" style={{ width: size, height: size }} aria-hidden>
      <span className="orb-core" />
    </span>
  );
}

/**
 * Knotten AI: a floating assistant that is a preview today. It answers with a fixed, honest line
 * and points to the interest form. When the project's real data is in place it gets a model behind
 * it that answers from the plots, the energy figures and the documents.
 */
export default function Chat({ locale }: { locale: Locale }) {
  const no = locale === "no";
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [text, setText] = useState("");
  const [typing, setTyping] = useState(false);
  const list = useRef<HTMLDivElement>(null);
  const greeting = no
    ? "Hei. Jeg er Knotten AI. Snart kan du spørre meg om tomter, sol, utsikt, energi og dokumenter. I dag er jeg en forhåndsvisning uten sanntidsdata."
    : "Hi. I am Knotten AI. Soon you can ask me about plots, sun, view, energy and documents. Today I am a preview without live data.";
  const canned = no
    ? "Kun forhåndsvisning. Jeg svarer ikke ennå og bruker ingen sanntidsdata. Meld interesse eller kontakt teamet i mellomtiden."
    : "Preview only. I do not answer yet and use no live data. Register interest or contact the team in the meantime.";
  const suggestions = no
    ? ["Hvilken tomt har mest vintersol?", "Hvor mange tomter har sjøutsikt?", "Når slippes tomtene?"]
    : ["Which plot has the most winter sun?", "How many plots have a sea view?", "When are the plots released?"];

  useEffect(() => { if (open && msgs.length === 0) setMsgs([{ from: "ai", text: greeting }]); }, [open, msgs.length, greeting]);
  useEffect(() => { list.current?.scrollTo({ top: list.current.scrollHeight, behavior: "smooth" }); }, [msgs, typing]);
  useEffect(() => {
    if (!open) return;
    const key = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [open]);

  const ask = (q: string) => {
    const t = q.trim();
    if (!t || typing) return;
    setMsgs((m) => [...m, { from: "you", text: t }]);
    setText("");
    setTyping(true);
    setTimeout(() => { setTyping(false); setMsgs((m) => [...m, { from: "ai", text: canned }]); }, 900);
  };

  return (
    <div className="fixed right-4 bottom-4 md:right-6 md:bottom-6 z-40 grid justify-items-end gap-3">
      <style>{`
        .orb { position: relative; display: inline-grid; place-items: center; border-radius: 50%; background: conic-gradient(from 0deg, #f0b254, #7fbccf, #6f9a80, #f0b254); animation: orb-turn 9s linear infinite; box-shadow: 0 0 18px rgba(240,178,84,.35); }
        .orb-core { width: 58%; height: 58%; border-radius: 50%; background: #17283a; }
        @keyframes orb-turn { to { transform: rotate(360deg); } }
        .ai-pill { display: inline-flex; align-items: center; gap: .6rem; padding: .5rem .95rem .5rem .55rem; border-radius: 999px; background: rgba(23,40,58,.92); border: 1px solid rgba(255,255,255,.18); color: #fff; backdrop-filter: blur(14px); -webkit-backdrop-filter: blur(14px); box-shadow: 0 16px 40px rgba(0,0,0,.35); transition: transform .2s ease, border-color .2s ease; }
        .ai-pill:hover { transform: translateY(-2px); border-color: rgba(240,178,84,.55); }
        .ai-panel { width: min(92vw, 400px); background: rgba(255,255,255,.94); color: var(--ink); backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px); border: 1px solid rgba(23,40,58,.12); border-radius: 22px; box-shadow: 0 30px 80px -20px rgba(23,40,58,.45); overflow: hidden; animation: rise-in .35s cubic-bezier(.2,.7,.2,1) both; }
        .dots span { display: inline-block; width: 5px; height: 5px; border-radius: 50%; background: var(--ink); opacity: .5; margin-right: 3px; animation: dot 1.2s infinite; }
        .dots span:nth-child(2) { animation-delay: .2s } .dots span:nth-child(3) { animation-delay: .4s }
        @keyframes dot { 0%, 80%, 100% { transform: translateY(0); opacity: .35 } 40% { transform: translateY(-4px); opacity: 1 } }
      `}</style>
      {open && (
        <div className="ai-panel" role="dialog" aria-label="Knotten AI">
          <div className="flex items-center gap-3 px-4 py-3 border-b line">
            <Orb size={26} />
            <div>
              <div className="font-medium text-[15px] leading-none">Knotten AI</div>
              <div className="text-[12px] text-muted mt-1">{no ? "Forhåndsvisning, ingen sanntidsdata" : "Preview, no live data"}</div>
            </div>
            <button className="ml-auto w-9 h-9 rounded-full grid place-items-center hover:bg-ink/10" onClick={() => setOpen(false)} aria-label={no ? "Lukk" : "Close"}>
              <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden><path d="M2 2l10 10M12 2L2 12" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></svg>
            </button>
          </div>
          <div ref={list} className="px-4 py-4 grid gap-2.5 max-h-[340px] overflow-auto text-[14.5px]">
            {msgs.map((m, i) => (
              <div key={i} className={`max-w-[86%] rounded-2xl px-3.5 py-2.5 leading-snug ${m.from === "ai" ? "bg-bg-2 text-ink rounded-tl-md" : "bg-ink text-white justify-self-end rounded-tr-md"}`}>{m.text}</div>
            ))}
            {typing && <div className="dots px-3.5 py-2.5 bg-bg-2 rounded-2xl rounded-tl-md justify-self-start"><span /><span /><span /></div>}
            {msgs.length <= 1 && (
              <div className="flex flex-wrap gap-1.5 mt-1">
                {suggestions.map((s) => <button key={s} className="chip hover:bg-ink/20 transition-colors" onClick={() => ask(s)}>{s}</button>)}
              </div>
            )}
          </div>
          <form onSubmit={(e) => { e.preventDefault(); ask(text); }} className="flex gap-2 p-3 border-t line">
            <input className="input !py-2.5 !rounded-full" value={text} onChange={(e) => setText(e.target.value)} placeholder={no ? "Spør om Knotten" : "Ask about Knotten"} aria-label={no ? "Melding" : "Message"} />
            <button className="btn btn-sm btn-plain !px-4" type="submit" aria-label={no ? "Send" : "Send"}>
              <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden><path d="M2 8h11M9 3.5L13.5 8 9 12.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" fill="none" /></svg>
            </button>
          </form>
        </div>
      )}
      <button onClick={() => setOpen((o) => !o)} aria-label="Knotten AI" aria-expanded={open} className="ai-pill">
        <Orb size={28} />
        <span className="text-[14px] font-medium pr-1">{open ? (no ? "Lukk" : "Close") : "Knotten AI"}</span>
      </button>
    </div>
  );
}
