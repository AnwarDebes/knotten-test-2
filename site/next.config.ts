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
  // the Klassisk design serves its photos and maps through next/image
  images: { formats: ["image/avif", "image/webp"] },
  experimental: {
    // two root layouts (one per design) need a 404 of their own: src/app/global-not-found.tsx
    globalNotFound: true,
    // document uploads in the portal go through server actions (lib/server/files.ts sets the real limit)
    serverActions: { bodySizeLimit: "26mb" },
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
