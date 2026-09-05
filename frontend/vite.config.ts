import path from "node:path";

import { defineConfig } from "vite";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: "./src/test/setup.ts",
    exclude: ["**/node_modules/**", "**/tests/**"],
    // Limit concurrency to avoid freezing low-memory machines (41 test files x jsdom + mermaid/excalidraw is heavy).
    // Forks isolate memory better than threads for jsdom; cap parallel files to 2 and run tests sequentially within a file.
    pool: "forks",
    forks: {
      singleFork: false,
      maxForks: 2,
      minForks: 1,
    },
    maxConcurrency: 2,
    sequence: {
      concurrent: false,
    },
    testTimeout: 15000,
    hookTimeout: 15000,
  },
  build: {
    outDir: "../internal/httpapi/static",
    emptyOutDir: true,
    rollupOptions: {
      output: {
        // Function form is required by Vite 8 (Rolldown); the object form
        // that Rollup accepted is rejected there.
        manualChunks(id) {
          if (id.includes("@xyflow/react")) {
            return "vendor-xyflow";
          }
        },
      },
    },
  },
  server: {
    host: "127.0.0.1",
    port: 5173
  }
});