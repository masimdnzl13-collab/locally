import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Locally'nin test paketi (AA). Tideline'ın kendi paketi tideline/ altında ayrı çalışır.
export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./", import.meta.url)) },
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    exclude: ["node_modules/**", "tideline/**", ".next/**"],
  },
});
