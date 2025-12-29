import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/cli/index.ts"],
  format: ["esm"],
  target: "node18",
  outDir: "dist",
  clean: true,
  shims: true,
  dts: false,
  sourcemap: false,
  minify: false,
});
