import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

const alias = { "@": fileURLToPath(new URL(".", import.meta.url)) };

export default defineConfig({
  test: {
    projects: [
      { resolve: { alias }, test: { name: "unit", include: ["test/*.test.ts"] } },
      // Needs a database: run with `npm run test:db`.
      { resolve: { alias }, test: { name: "db", include: ["test/db/*.test.ts"], fileParallelism: false } },
    ],
  },
});
