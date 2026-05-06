import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Attach CORS headers for every /api/* response. We echo the requesting
// origin when it looks like a Chrome extension (chrome-extension://<id>),
// which is the only shape `Access-Control-Allow-Origin` accepts — wildcards
// like "chrome-extension://*" are invalid per the CORS spec and get rejected
// by browsers at preflight time.
export function middleware(req: NextRequest) {
  const origin = req.headers.get("origin") ?? "";
  const allowOrigin = origin.startsWith("chrome-extension://") ? origin : "*";

  if (req.method === "OPTIONS") {
    return new NextResponse(null, {
      status: 204,
      headers: buildCorsHeaders(allowOrigin),
    });
  }

  const res = NextResponse.next();
  const headers = buildCorsHeaders(allowOrigin);
  for (const [key, value] of Object.entries(headers)) {
    res.headers.set(key, value);
  }
  return res;
}

function buildCorsHeaders(origin: string): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}

export const config = {
  matcher: "/api/:path*",
};
