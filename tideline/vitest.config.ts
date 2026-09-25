import { defineConfig } from "vitest/config";

// Kept even though it only restates the defaults: without it, vitest walks up and picks
// the Locally app's vitest.config.ts at the repo root (tests/**/*.test.ts), and finds no tests here.
export default defineConfig({ test: {} });
