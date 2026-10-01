import { mutate } from "./kv";
import { sha256 } from "./crypto";

/**
 * A simple brake for public forms: at most `max` actions per `windowMin` minutes from one address.
 * Addresses are kept as a one-way code, only for the length of the window.
 */
export async function allow(bucket: string, ip: string, max: number, windowMin: number) {
  const id = sha256(`${bucket}|${ip}`).slice(0, 20);
  return mutate<Record<string, number[]>, boolean>(`limit-${bucket}`, () => ({}), (v) => {
    const t = Date.now();
    const cut = t - windowMin * 60000;
    for (const k of Object.keys(v)) {
      v[k] = v[k].filter((x) => x > cut);
      if (!v[k].length) delete v[k];
    }
    const list = v[id] ?? [];
    if (list.length >= max) return false;
    v[id] = [...list, t];
    return true;
  });
}
