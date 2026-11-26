import path from "path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  // Django serves the built SPA under STATIC_URL, so all emitted asset URLs
  // (including lazy-loaded chunks) must use that prefix.
  base: "/static/website/samarqand_spa/",
  plugins: [react()],
  server: {
    allowedHosts: true,
    proxy: {
      "/api": {
        target: "http://127.0.0.1:8123",
        changeOrigin: true,
      },
      "/docs": {
        target: "http://127.0.0.1:8123",
        changeOrigin: true,
      },
      "/media": {
        target: "http://127.0.0.1:8123",
        changeOrigin: true,
      },
      "/static": {
        target: "http://127.0.0.1:8123",
        changeOrigin: true,
      },
    },
  },
  build: {
    chunkSizeWarningLimit: 5000,
    outDir: "../../website/static/website/samarqand_spa",
    emptyOutDir: true,
    rollupOptions: {
      output: {
        manualChunks: {
          react: ["react", "react-dom", "react-router"],
          icons: ["lucide-react"],
        },
      },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
