import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
  },
  resolve: {
    alias: {
      "@/": path.resolve(__dirname, "./") + "/",
      "@dochat/db": path.resolve(__dirname, "../../packages/db/src"),
      "@dochat/shared": path.resolve(__dirname, "../../packages/shared/src"),
    },
  },
});
