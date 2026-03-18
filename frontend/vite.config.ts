import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: "./src/test/setup.ts"
  },
  build: {
    outDir: "../internal/httpapi/static",
    emptyOutDir: true
  },
  server: {
    host: "127.0.0.1",
    port: 5173
  }
});