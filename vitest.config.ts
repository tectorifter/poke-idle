import { defineConfig } from "vitest/config";

// Standalone from vite.config.ts — the app's Tailwind/React plugins aren't
// needed (and slow down) the pure combat-logic tests.
export default defineConfig({
  resolve: {
    alias: { "@": new URL("./src", import.meta.url).pathname },
  },
  test: {
    environment: "node",
    include: ["test/**/*.test.ts"],
    // let the sim.report tables print straight to stdout
    disableConsoleIntercept: true,
  },
});
