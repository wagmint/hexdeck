import { defineConfig } from "tsup";

export default defineConfig({
  entry: {
    index: "src/index.ts",
    "tailwind-preset": "src/tailwind-preset.ts",
  },
  format: ["cjs", "esm"],
  dts: true,
  splitting: true,
  clean: true,
  external: ["react", "react-dom"],
  banner: {
    js: '"use client";',
  },
});
