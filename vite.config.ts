import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { cloudflare } from "@cloudflare/vite-plugin";
export default defineConfig({
  base: "/corbs/",
  plugins: [react(), cloudflare({ inspectorPort: false })],
  build: { target: "es2022" },
  server: { host: "127.0.0.1", port: 5196, strictPort: true },
});
