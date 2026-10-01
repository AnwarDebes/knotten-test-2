import type { MetadataRoute } from "next";

const SITE = (process.env.SITE_URL || "https://knotten.no").replace(/\/$/, "");

/** Search engines may read the website, not the portal, the login screens or the data endpoints. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/api/", "/no/portal", "/en/portal", "/no/login", "/en/login", "/logg-inn"] }],
    sitemap: `${SITE}/sitemap.xml`,
  };
}
