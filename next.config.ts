import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // pdf-parse (and the pdfjs-dist/canvas it relies on) ship worker/native
  // assets that Turbopack's server bundler can't resolve; run them via
  // plain Node `require` instead of bundling them.
  serverExternalPackages: ["pdf-parse", "@napi-rs/canvas"],
};

export default nextConfig;
