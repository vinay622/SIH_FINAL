import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig(({ command }) => ({
  // Production is served by FastAPI under /ui; Vite development stays at /.
  base: command === "build" ? "/ui/" : "/",
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    // Demo API runs on :8000 — proxy so the SPA and API share one origin,
    // which also keeps the (optional) X-API-Key out of the browser.
    proxy: {
      "/api": {
        target: "http://localhost:8000",
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: "dist",
  },
  test: {
    environment: "jsdom",
    setupFiles: "./src/test/setup.ts",
  },
}));
