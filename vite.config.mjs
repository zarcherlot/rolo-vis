import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  build: {
    outDir: "dist/client",
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("node_modules/@xyflow/react")) return "flow-vendor";
          if (id.includes("node_modules/@phosphor-icons/react")) return "icons-vendor";
          if (id.includes("node_modules/react") || id.includes("node_modules/react-dom")) return "react-vendor";
          if (id.includes("/src/lerobotAnalysisData")) return "analysis-data";
          return undefined;
        },
      },
    },
  },
  optimizeDeps: {
    include: ["react", "react-dom/client"],
  },
  preview: {
    host: "127.0.0.1",
    proxy: {
      "/rolo-api": {
        target: process.env.ROLO_API_PROXY_TARGET || "http://127.0.0.1:8080",
        changeOrigin: false,
        rewrite: (path) => path.replace(/^\/rolo-api/, ""),
      },
    },
  },
  server: {
    host: "0.0.0.0",
    allowedHosts: ["terminal.local"],
    proxy: {
      "/rolo-api": {
        target: process.env.ROLO_API_PROXY_TARGET || "http://127.0.0.1:8080",
        changeOrigin: false,
        rewrite: (path) => path.replace(/^\/rolo-api/, ""),
      },
    },
    warmup: {
      clientFiles: ["./src/main.tsx"],
    },
  },
  plugins: [react()],
});
