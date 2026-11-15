import { defineConfig } from "vitest/config";
import { dirname, resolve } from "node:path";

/**
 * Unit tests for the platform API.
 *
 * The API compiles with NodeNext, so every relative import carries a `.js` extension
 * even though the file on disk is `.ts`. The small resolver below maps those specifiers
 * back to TypeScript so the tests run against source rather than a stale `dist/`.
 */
export default defineConfig({
  plugins: [
    {
      name: "resolve-ts-from-js-specifiers",
      enforce: "pre",
      resolveId(source, importer) {
        if (!source.endsWith(".js")) return null;
        if (!source.startsWith(".")) return null;
        const base = importer ? dirname(importer) : process.cwd();
        return resolve(base, source.replace(/\.js$/, ".ts"));
      },
    },
  ],
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    reporters: process.env.CI ? ["github-actions", "default"] : ["default"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json-summary"],
      include: ["src/lib/**/*.ts"],
      exclude: ["src/scripts/**"],
    },
  },
});
