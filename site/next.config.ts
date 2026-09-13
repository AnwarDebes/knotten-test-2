import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // the floating "N" badge in dev confused reviewers; it never ships to production anyway
  devIndicators: false,
  turbopack: { root: __dirname },
};

export default nextConfig;
