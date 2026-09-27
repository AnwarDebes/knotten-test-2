import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // the floating "N" badge in dev confused reviewers; it never ships to production anyway
  devIndicators: false,
  turbopack: { root: __dirname },
  // the Klassisk design serves its photos and maps through next/image
  images: { formats: ["image/avif", "image/webp"] },
  // two root layouts (one per design) need a 404 of their own: src/app/global-not-found.tsx
  experimental: { globalNotFound: true },
};

export default nextConfig;
