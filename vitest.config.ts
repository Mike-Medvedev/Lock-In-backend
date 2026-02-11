import path from "path";
import { defineConfig } from "vitest/config";
import { loadEnv } from "vite";

export default defineConfig(({ mode }) => ({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@root": path.resolve("./"),
    },
  },
  test: {
    name: "Lock-In Tests",
    root: "./src",
    environment: "node",
    env: loadEnv(mode, process.cwd(), ""),
    server: {
      deps: {
        inline: ["supertest"],
      },
    },
  },
}));
