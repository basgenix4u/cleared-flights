import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

/**
 * Unit tests for the web app.
 *
 * These cover the pure logic that money and content pass through — pricing, fee
 * arithmetic, formatting, query parsing and markdown rendering — so a regression
 * fails in CI without needing a database or a browser. Anything that touches the
 * network or Postgres belongs in the integration suite.
 */
export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    environment: "node",
    include: ["tests/unit/**/*.test.ts"],
    reporters: process.env.CI ? ["github-actions", "default"] : ["default"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json-summary"],
      include: ["src/lib/**/*.ts"],
      exclude: ["src/lib/server/**", "src/lib/providers/**", "src/lib/payments/**", "src/lib/email/**"],
      // Coverage is enforced where a regression would cost money or trust: the fee
      // arithmetic, the markdown/XSS boundary, and query parsing. The rest of `src/lib`
      // is integration-tested against a real database instead of unit-tested with mocks.
      thresholds: {
        "src/lib/pricing.ts": { lines: 90, functions: 90, branches: 85, statements: 90 },
        "src/lib/markdown.ts": { lines: 85, functions: 85, branches: 75, statements: 85 },
        "src/lib/search-params.ts": { lines: 75, functions: 80, branches: 70, statements: 75 },
        "src/lib/format.ts": { lines: 70, functions: 70, branches: 65, statements: 70 },
      },
    },
  },
});
