import type { NextConfig } from "next";

// CORS headers are applied per-request in middleware.ts so we can echo the
// actual extension origin (chrome-extension://<id>) instead of a wildcard,
// which the CORS spec doesn't allow mid-string.
const nextConfig: NextConfig = {};

export default nextConfig;
