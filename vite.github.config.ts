import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const projectRoot = fileURLToPath(new URL(".", import.meta.url));
const outputDirectory = resolve(projectRoot, "docs");

export default defineConfig({
  root: resolve(projectRoot, "github-pages"),
  base: "/dead-freight/",
  publicDir: resolve(projectRoot, "public"),
  plugins: [
    react(),
    {
      name: "github-pages-nojekyll",
      closeBundle() {
        writeFileSync(resolve(outputDirectory, ".nojekyll"), "");
      },
    },
  ],
  build: {
    outDir: outputDirectory,
    emptyOutDir: true,
  },
});
