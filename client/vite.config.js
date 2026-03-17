import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { nodePolyfills } from "vite-plugin-node-polyfills";

export default defineConfig({
  plugins: [
    react(),
    nodePolyfills(),
  ],
  server: {
    host: true,
    proxy: {
      "/socket.io": {
        target: "http://localhost:3001",
        ws: true,
      },
    },
  },
});