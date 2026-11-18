import path from "node:path";

const dev = process.env.NODE_ENV !== "production";
// The browser only talks to this app's own API. Next.js needs inline scripts for hydration; dev also needs eval for fast refresh.
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${dev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "media-src 'self' blob:",
  "font-src 'self' data:",
  "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join("; ");

export default {
  outputFileTracingRoot: process.cwd(),
  serverExternalPackages: ["pg", "nostr-tools", "@getalby/sdk", "ws"],
  poweredByHeader: false,
  distDir: process.env.NEXT_DIST_DIR || ".next", // lets a second build (tests, previews) live beside the dev server
  async headers() {
    return [{
      source: "/:path*",
      headers: [
        { key: "Content-Security-Policy", value: csp },
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "X-Frame-Options", value: "DENY" },
        { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        { key: "Permissions-Policy", value: "microphone=(self), camera=(), geolocation=(), payment=()" },
        { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
      ],
    }];
  },
  webpack(config) {
    config.resolve.alias["@"] = path.resolve(process.cwd(), "src");
    return config;
  },
};
