const { withSentryConfig } = require("@sentry/nextjs/config");

// Next.js's own hydration bootstrap emits inline <script> tags, so
// script-src still needs 'unsafe-inline' here — this is defense-in-depth on
// top of React's built-in output escaping (verified separately), not a
// replacement for it. Everything else is locked down: no framing, no
// cross-origin form posts, no plugins/objects.
const CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: https:",
  "font-src 'self' data:",
  "connect-src 'self' https://*.sentry.io",
  "frame-ancestors 'none'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join("; ");

const securityHeaders = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "Content-Security-Policy", value: CSP },
];

// (no-op comment: forces a fresh Railway build after repeated
// "no .next build" crashes on redeploys — see chat history 2026-09-17)
/** @type {import('next').NextConfig} */
const nextConfig = {
  poweredByHeader: false,
  typescript: {
    ignoreBuildErrors: false,
  },
  experimental: {
    serverActions: {
      bodySizeLimit: "5mb",
    },
  },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**" },
    ],
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

// Wrapping is safe with no SENTRY_AUTH_TOKEN/SENTRY_ORG/SENTRY_PROJECT set —
// it just skips the sourcemap upload step (logged as a warning) and leaves
// the rest of the build untouched.
module.exports = withSentryConfig(nextConfig, {
  silent: true,
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
});
