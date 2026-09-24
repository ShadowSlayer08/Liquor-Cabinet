import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const UA =
  "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Mobile Safari/537.36";

// The Android app fetches Livcheers / Zomato natively (CapacitorHttp, no CORS).
// In a desktop browser those requests would be blocked by CORS, so `npm run dev`
// routes them through these proxies instead. See src/lib/http.js.
// Browser-only headers (client hints, fetch metadata, cookies) are stripped so the
// upstream sees the same request the native app sends.
const BROWSER_ONLY = /^(sec-|cookie$|referer$|origin$)/i;
const proxy = (target) => ({
  target,
  changeOrigin: true,
  secure: true,
  headers: { "User-Agent": UA, "Accept-Language": "en-IN,en;q=0.9" },
  rewrite: (p) => p.replace(/^\/proxy\/[a-z]+/, ""),
  configure: (server) => {
    server.on("proxyReq", (req) => {
      const cookie = req.getHeader("x-proxy-cookie");
      for (const h of req.getHeaderNames()) if (BROWSER_ONLY.test(h) || h === "x-proxy-cookie") req.removeHeader(h);
      if (cookie) req.setHeader("Cookie", cookie);
    });
  },
});

export default defineConfig({
  plugins: [react()],
  base: "./",
  server: {
    host: true,
    proxy: {
      "/proxy/livcheers": proxy("https://www.livcheers.com"),
      "/proxy/zomato": proxy("https://www.zomato.com"),
    },
  },
  preview: {
    proxy: {
      "/proxy/livcheers": proxy("https://www.livcheers.com"),
      "/proxy/zomato": proxy("https://www.zomato.com"),
    },
  },
  build: { outDir: "dist", target: "es2020", chunkSizeWarningLimit: 900 },
});
