import { defineConfig } from "vite";
import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  // Relative base so this works unmodified whether it's served from a domain
  // root, a GitHub Pages project subpath (https://user.github.io/repo/), or
  // opened straight from the filesystem.
  base: "./",
  resolve: {
    alias: {
      "@": new URL("./src", import.meta.url).pathname,
    },
  },
  server: {
    host: "0.0.0.0",
    port: 8080,
  },
  plugins: [tailwindcss(), viteReact()],
});
