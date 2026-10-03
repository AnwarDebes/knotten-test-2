import type { NextConfig } from "next";

/** Sent with every page: no framing by other sites, no MIME sniffing, a careful referrer, no device access. */
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
];

const nextConfig: NextConfig = {
  // the floating "N" badge in dev confused reviewers; it never ships to production anyway
  devIndicators: false,
  poweredByHeader: false,
  turbopack: { root: __dirname },
  // the Klassisk design serves its photos and maps through next/image, at the qualities its pages ask
  // for (Next 16 allows only 75 unless they are listed, and quietly lowers the rest)
  images: { formats: ["image/avif", "image/webp"], qualities: [75, 80, 85, 88, 90, 92] },
  experimental: {
    // two root layouts (one per design) need a 404 of their own: src/app/global-not-found.tsx
    globalNotFound: true,
    // document uploads in the portal go through server actions (lib/server/files.ts sets the real limit)
    serverActions: { bodySizeLimit: "26mb" },
  },
  // the server reads only public/data at run time: the 3D, the images and the documents stay out of the server
  // bundles, and so do the private records (password hashes, the session secret, uploads), whatever is on disk
  outputFileTracingExcludes: {
    "/*": ["./data/private/**/*", "./data/leads.json", "./public/twin/**/*", "./public/renders/**/*", "./public/img/**/*", "./public/assets/**/*", "./public/docs/**/*", "./public/draco/**/*", "./public/models/**/*"],
  },
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      // the 3D model's data (13 MB, some 35 files): the browser keeps its copy but asks the server before each use, so
      // every visit gets the model as last published. A file that has not changed is answered "not modified" and is
      // not downloaded again. twin.json lists the other files, so all of them are checked, never twin.json alone:
      // a new twin.json beside an older texture from the cache would not match.
      { source: "/twin/:path*", headers: [{ key: "Cache-Control", value: "public, no-cache" }] },
      // the pictures: kept by the browser and refreshed in the background (a change reaches everyone within a day)
      { source: "/(renders|assets|img)/:path*", headers: [{ key: "Cache-Control", value: "public, max-age=86400, stale-while-revalidate=2592000" }] },
    ];
  },
};

export default nextConfig;
