"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { Locale } from "@/lib/i18n";

type Msg = { from: "you" | "ai"; text: string; links?: { href: string; label: string }[]; source?: string };

/** The mark of Knotten AI: a small sun that turns slowly, amber into fjord blue. */
export function Orb({ size = 22 }: { size?: number }) {
  return (
    <span className="orb" style={{ width: size, height: size }} aria-hidden>
      <span className="orb-core" />
    </span>
  );
}

/**
 * Knotten AI: a floating assistant that answers from the project's own data (/api/ask): the plots,
 * sun and view, the energy concept, the power price and the weather right now, the road, the area
 * and the release. It links to where each answer is shown, and says so when it does not know.
 */
export default function Chat({ locale }: { locale: Locale }) {
  const no = locale === "no";
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [text, setText] = useState("");
  const [typing, setTyping] = useState(false);
  const list = useRef<HTMLDivElement>(null);
  const pill = useRef<HTMLButtonElement>(null);
  const input = useRef<HTMLInputElement>(null);
  // once the visitor reads on down the page, the pill folds to its round mark, so it covers less of the text; on a
  // phone it is the round mark from the start (the full pill covered the 3D card's text in the first screen)
  const [small, setSmall] = useState(false);
  useEffect(() => {
    const on = () => setSmall(window.scrollY > 640 || window.innerWidth < 640);
    on();
    window.addEventListener("scroll", on, { passive: true });
    window.addEventListener("resize", on);
    return () => { window.removeEventListener("scroll", on); window.removeEventListener("resize", on); };
  }, []);
  // the keyboard goes into the chat as it opens, and back to the pill as it closes
  const close = () => { setOpen(false); pill.current?.focus(); };
  useEffect(() => { if (open) input.current?.focus(); }, [open]);
  const greeting = no
    ? "Hei. Jeg er Knotten AI. Spør meg om tomtene, sol og utsikt, energien, strømprisen eller været nå, eller når tomtene slippes. Jeg svarer fra prosjektets egne data."
    : "Hi. I am Knotten AI. Ask me about the plots, sun and view, the energy, the power price or the weather right now, or when the plots are released. I answer from the project's own data.";
  const suggestions = no
    ? ["Hvilken tomt har mest vintersol?", "Hvor mange tomter har sjøutsikt?", "Når slippes tomtene?", "Hva koster strømmen nå?"]
    : ["Which plot has the most winter sun?", "How many plots have a sea view?", "When are the plots released?", "What does power cost now?"];
  const all: Msg[] = [{ from: "ai", text: greeting }, ...msgs];
  useEffect(() => { list.current?.scrollTo({ top: list.current.scrollHeight, behavior: "smooth" }); }, [msgs, typing]);
  useEffect(() => {
    if (!open) return;
    const key = (e: KeyboardEvent) => { if (e.key === "Escape") { setOpen(false); pill.current?.focus(); } };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [open]);

  const ask = async (q: string) => {
    const t = q.trim();
    if (!t || typing) return;
    setMsgs((m) => [...m, { from: "you", text: t }]);
    setText("");
    setTyping(true);
    try {
      const res = await fetch("/api/ask", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ q: t, locale }) });
      const a = (await res.json()) as { text?: string; links?: Msg["links"]; source?: string };
      setMsgs((m) => [...m, { from: "ai", text: a.text ?? (no ? "Noe gikk galt. Prøv igjen." : "Something went wrong. Try again."), links: a.links, source: a.source }]);
    } catch {
      setMsgs((m) => [...m, { from: "ai", text: no ? "Jeg fikk ikke kontakt akkurat nå. Prøv igjen om litt." : "I could not connect just now. Try again shortly." }]);
    } finally {
      setTyping(false);
    }
  };

  return (
    // (the pill comes first in the page's order, so Tab goes from it into the chat; the chat is drawn above it)
    <div className="fixed right-4 bottom-4 md:right-6 md:bottom-6 z-40 flex flex-col-reverse items-end gap-3">
      <style>{`
        .orb { position: relative; display: inline-grid; place-items: center; border-radius: 50%; background: conic-gradient(from 0deg, #f0b254, #7fbccf, #6f9a80, #f0b254); animation: orb-turn 9s linear infinite; box-shadow: 0 0 18px rgba(240,178,84,.35); }
        .orb-core { width: 58%; height: 58%; border-radius: 50%; background: #17283a; }
        @keyframes orb-turn { to { transform: rotate(360deg); } }
        .ai-pill { display: inline-flex; align-items: center; gap: .6rem; padding: .5rem .95rem .5rem .55rem; border-radius: 999px; background: rgba(23,40,58,.92); border: 1px solid rgba(255,255,255,.18); color: #fff; backdrop-filter: blur(14px); -webkit-backdrop-filter: blur(14px); box-shadow: 0 16px 40px rgba(0,0,0,.35); transition: transform .2s ease, border-color .2s ease; }
        .ai-pill:hover { transform: translateY(-2px); border-color: rgba(240,178,84,.55); }
        .ai-pill.small { padding: .5rem; }
        .ai-panel { width: min(92vw, 400px); background: rgba(255,255,255,.94); color: var(--ink); backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px); border: 1px solid rgba(23,40,58,.12); border-radius: 22px; box-shadow: 0 30px 80px -20px rgba(23,40,58,.45); overflow: hidden; animation: rise-in .35s cubic-bezier(.2,.7,.2,1) both; }
        .dots span { display: inline-block; width: 5px; height: 5px; border-radius: 50%; background: var(--ink); opacity: .5; margin-right: 3px; animation: dot 1.2s infinite; }
        .dots span:nth-child(2) { animation-delay: .2s } .dots span:nth-child(3) { animation-delay: .4s }
        @keyframes dot { 0%, 80%, 100% { transform: translateY(0); opacity: .35 } 40% { transform: translateY(-4px); opacity: 1 } }
      `}</style>
      <button ref={pill} onClick={() => (open ? close() : setOpen(true))} aria-expanded={open} aria-controls={open ? "knotten-ai" : undefined} className={`ai-pill ${small && !open ? "small" : ""}`}>
        <Orb size={28} />
        <span className={small && !open ? "sr-only" : "text-[14px] font-medium pr-1"}>{open ? (no ? "Lukk" : "Close") : "Knotten AI"}</span>
      </button>
      {open && (
        <div id="knotten-ai" className="ai-panel flex flex-col max-h-[calc(100dvh-6.5rem)]" role="dialog" aria-label="Knotten AI">
          <div className="flex items-center gap-3 px-4 py-3 border-b line">
            <Orb size={26} />
            <div>
              <div className="font-medium text-[15px] leading-none">Knotten AI</div>
              <div className="text-[12px] text-muted mt-1">{no ? "Svarer fra prosjektets egne data" : "Answers from the project's own data"}</div>
            </div>
            <button className="ml-auto w-9 h-9 rounded-full grid place-items-center hover:bg-ink/10" onClick={close} aria-label={no ? "Lukk" : "Close"}>
              <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden><path d="M2 2l10 10M12 2L2 12" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></svg>
            </button>
          </div>
          <div ref={list} role="log" aria-live="polite" className="px-4 py-4 grid gap-2.5 max-h-[340px] min-h-0 flex-1 overflow-auto text-[14.5px]">
            {all.map((m, i) => (
              <div key={i} className={`max-w-[88%] rounded-2xl px-3.5 py-2.5 leading-snug ${m.from === "ai" ? "bg-bg-2 text-ink rounded-tl-md" : "bg-ink text-white justify-self-end rounded-tr-md"}`}>
                {m.text}
                {m.links && m.links.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {m.links.map((l) => <Link key={l.href} href={l.href} onClick={() => setOpen(false)} className="chip chip-fjord no-underline !text-[12px] hover:!bg-[var(--sky)]">{l.label}</Link>)}
                  </div>
                )}
                {m.source === "ai" && <div className="text-[11.5px] text-muted mt-1.5">{no ? "Skrevet av en språkmodell ut fra prosjektets fakta." : "Written by a language model from the project's facts."}</div>}
              </div>
            ))}
            {typing && <div className="dots px-3.5 py-2.5 bg-bg-2 rounded-2xl rounded-tl-md justify-self-start"><span aria-hidden /><span aria-hidden /><span aria-hidden /><em className="sr-only">{no ? "Knotten AI skriver" : "Knotten AI is typing"}</em></div>}
            {msgs.length === 0 && (
              <div className="flex flex-wrap gap-1.5 mt-1">
                {suggestions.map((s) => <button key={s} className="chip hover:bg-ink/20 transition-colors" onClick={() => ask(s)}>{s}</button>)}
              </div>
            )}
          </div>
          <form onSubmit={(e) => { e.preventDefault(); ask(text); }} className="flex gap-2 p-3 border-t line">
            <input ref={input} className="input !py-2.5 !rounded-full" value={text} onChange={(e) => setText(e.target.value)} placeholder={no ? "Spør om Knotten" : "Ask about Knotten"} aria-label={no ? "Melding" : "Message"} />
            <button className="btn btn-sm btn-plain !px-4" type="submit" aria-label={no ? "Send" : "Send"}>
              <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden><path d="M2 8h11M9 3.5L13.5 8 9 12.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" fill="none" /></svg>
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
