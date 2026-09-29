import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";

// Strict CSP for the built app. Only injected at build time because the dev
// server relies on inline scripts for hot reload.
// TODO(security): frame-ancestors / X-Frame-Options can't be set via <meta>;
// add them as HTTP headers wherever this gets hosted.
// TODO(security): when Wikidata fetching is added, extend connect-src to
// https://query.wikidata.org only, and validate responses.
const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self'",
  "img-src 'self' data:",
  "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'none'",
].join("; ");

const cspMeta = (): Plugin => ({
  name: "csp-meta",
  apply: "build",
  transformIndexHtml: () => [
    {
      tag: "meta",
      attrs: { "http-equiv": "Content-Security-Policy", content: CSP },
      injectTo: "head-prepend",
    },
  ],
});

export default defineConfig({
  // Relative asset URLs so the built site works under a sub-path (GitHub Pages).
  base: "./",
  plugins: [react(), cspMeta()],
  server: { host: "127.0.0.1", port: 5173 },
  preview: { host: "127.0.0.1", port: 4173 },
});
