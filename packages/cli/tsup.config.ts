import { defineConfig } from "tsup";

export default defineConfig({
  entry: {
    index: "src/index.ts",
    "lib/launcher": "src/lib/launcher.ts",
  },
  format: ["esm"],
  target: "node20",
  platform: "node",
  splitting: true,
  outDir: "dist",
  external: [
    "hono",
    "@hono/node-server",
  ],
  clean: true,
});
