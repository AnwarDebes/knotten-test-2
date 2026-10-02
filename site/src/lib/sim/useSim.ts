"use client";
/**
 * The page side of the energy simulation: one worker, one year per scenario, results cached (the
 * last few scenarios), so switching back and forth is instant.
 */
import { useEffect, useState } from "react";
import type { HomeSpec, Scenario, YearResult } from "./run";
import { BASE } from "./scenario";

export type SimInfo = {
  year: number;
  sources: Record<string, string>;
  park: { x: number; y: number; z: number; name: string };
  pvgis: Record<string, number>;
  tmy_months: [number, number][];
};
type Out = { result: YearResult; info: SimInfo };

let worker: Worker | null = null;
let seq = 0;
const pending = new Map<number, { resolve: (v: Out) => void; reject: (e: Error) => void }>();
const cache = new Map<string, Promise<Out>>();

function getWorker() {
  if (!worker) {
    worker = new Worker(new URL("./sim.worker.ts", import.meta.url), { type: "module" });
    worker.onmessage = (e: MessageEvent<{ id: number; result?: YearResult; inputs?: SimInfo; error?: string }>) => {
      const p = pending.get(e.data.id);
      pending.delete(e.data.id);
      if (!p) return;
      if (e.data.error || !e.data.result || !e.data.inputs) p.reject(new Error(e.data.error ?? "simulation failed"));
      else p.resolve({ result: e.data.result, info: e.data.inputs });
    };
  }
  return worker;
}

export function simulate(homes: HomeSpec[], scenario: Scenario): Promise<Out> {
  const key = `${homes.length}|${JSON.stringify(scenario)}`;
  let p = cache.get(key);
  if (!p) {
    p = new Promise<Out>((resolve, reject) => {
      const id = ++seq;
      pending.set(id, { resolve, reject });
      getWorker().postMessage({ id, homes, scenario, base: BASE, origin: location.origin });
    });
    p.catch(() => cache.delete(key));
    cache.set(key, p);
    // keep the last six years in memory (each is a few megabytes of hourly series)
    while (cache.size > 6) cache.delete(cache.keys().next().value as string);
  }
  return p;
}

export function useSim(homes: HomeSpec[], scenario: Scenario, enabled = true) {
  const [state, setState] = useState<{ out: Out | null; error: string | null; busy: boolean }>({ out: null, error: null, busy: true });
  const key = JSON.stringify(scenario);
  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- marks the run as busy while the worker computes the new scenario
    setState((s) => ({ ...s, busy: true }));
    simulate(homes, JSON.parse(key)).then((out) => { if (alive) setState({ out, error: null, busy: false }); }).catch((e) => { if (alive) setState((s) => ({ ...s, error: String(e), busy: false })); });
    return () => { alive = false; };
  }, [homes, key, enabled]);
  return state;
}
