import type { NextConfig } from "next";
import { setupDevPlatform } from "@cloudflare/next-on-pages/next-dev";

// Enable Cloudflare bindings (D1, KV, etc.) in `next dev`
if (process.env.NODE_ENV === "development") {
  await setupDevPlatform();
}

const nextConfig: NextConfig = {
  // "export" is required by next-on-pages (static export + edge functions)
  // Remove "standalone" — not compatible with CF Pages deployment
};

export default nextConfig;
