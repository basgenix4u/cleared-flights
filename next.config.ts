import type { NextConfig } from "next";

/**
 * Security headers are set here rather than in middleware so they apply to static
 * assets and error pages too, and so they cannot be bypassed by a route that forgets
 * to call a helper.
 *
 * CSP notes:
 * - `'unsafe-inline'` for styles is required by Next's injected critical CSS.
 * - No `unsafe-eval` in production: React 19 does not need it.
 * - `img-src` allows data: for inline SVG marks, and https: because airline logos
 *   are provider-supplied URLs.
 * - `frame-ancestors 'none'` is deliberate: a booking flow must never be framed.
 */
const csp = [
  "default-src 'self'",
  "script-src 'self'" + (process.env.NODE_ENV === "production" ? "" : " 'unsafe-eval'") + " 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: https:",
  "font-src 'self' data:",
  "connect-src 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "object-src 'none'",
].join("; ");

const nextConfig: NextConfig = {
  poweredByHeader: false,
  compress: true,
  images: {
    formats: ["image/avif", "image/webp"],
    minimumCacheTTL: 60 * 60 * 24 * 30,
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Content-Security-Policy", value: csp },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(self)" },
          { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
        ],
      },
      {
        // Never leave a booking page in a shared cache.
        source: "/trips/:path*",
        headers: [{ key: "Cache-Control", value: "no-store, max-age=0" }],
      },
      {
        source: "/api/:path*",
        headers: [{ key: "Cache-Control", value: "no-store, max-age=0" }],
      },
    ];
  },
};

export default nextConfig;
