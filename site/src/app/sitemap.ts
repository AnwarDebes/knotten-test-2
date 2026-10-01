import type { MetadataRoute } from "next";
import { loadPlots } from "@/lib/data";

const SITE = (process.env.SITE_URL || "https://knotten.no").replace(/\/$/, "");

/**
 * The public pages of both designs: Klassisk at the root (the default), Moderne in Norwegian and
 * English, and one page per plot. The portal and the login screens are left out.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const klassisk = ["", "/prosjektet", "/tomtene", "/energi", "/eksisterende-bygg", "/investorer", "/dokumentbank", "/kart", "/galleri", "/kilder", "/kontakt", "/personvern"];
  const moderne = ["", "/tomter", "/utsikt", "/energi", "/energi/eksisterende", "/omradet", "/prosjektet", "/investor", "/dokumenter", "/nyheter", "/interesse", "/kontakt", "/personvern"];
  const { plots } = await loadPlots();
  const now = new Date();
  return [
    ...klassisk.map((p) => ({ url: `${SITE}${p || "/"}`, lastModified: now, changeFrequency: "weekly" as const, priority: p ? 0.7 : 1 })),
    ...["no", "en"].flatMap((l) => moderne.map((p) => ({ url: `${SITE}/${l}${p}`, lastModified: now, changeFrequency: "weekly" as const, priority: l === "no" ? 0.6 : 0.5 }))),
    ...["no", "en"].flatMap((l) => plots.map((p) => ({ url: `${SITE}/${l}/tomter/${p.id}`, lastModified: now, changeFrequency: "monthly" as const, priority: 0.4 }))),
  ];
}
