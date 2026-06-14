import type { NextConfig } from "next";

// Security headers applied to every response. We deliberately keep the
// Content-Security-Policy to directives that cannot break Next.js's inline
// bootstrap scripts, Tailwind's injected styles, or the iyzico hosted-page
// redirect: `frame-ancestors` (clickjacking), `base-uri`, and `object-src`.
// A stricter nonce-based script/style policy would need a proxy and is a
// separate, riskier change.
const securityHeaders = [
  {
    key: "Strict-Transport-Security",
    value: "max-age=31536000; includeSubDomains",
  },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), browsing-topics=()",
  },
  {
    key: "Content-Security-Policy",
    value: "frame-ancestors 'none'; base-uri 'self'; object-src 'none'",
  },
];

const nextConfig: NextConfig = {
  // The iyzipay SDK loads its resource files with a dynamic require() that the
  // production bundler (Turbopack) cannot statically resolve. Keep it out of the
  // server bundle and let it run via native Node require at runtime.
  serverExternalPackages: ["iyzipay", "pdfkit"],
  // The PDF route imports src/lib/pdf/tickets-pdf, which loads vendored TTFs via
  // new URL("./fonts/", import.meta.url). Turbopack does not trace those binary
  // assets automatically; include them so the built route can read them at runtime.
  outputFileTracingIncludes: {
    "/tickets/[token]/pdf": ["./src/lib/pdf/fonts/**/*.ttf"],
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
