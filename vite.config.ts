import { existsSync } from "node:fs";
import { resolve } from "node:path";

const localNodeModules = resolve(__dirname, "node_modules");
const fallbackNodeModules = resolve(__dirname, "../frontend/node_modules");
const nodeModules = existsSync(resolve(localNodeModules, "react")) ? localNodeModules : fallbackNodeModules;

export default {
  publicDir: "public",
  resolve: {
    alias: {
      react: resolve(nodeModules, "react"),
      "react-dom/client": resolve(nodeModules, "react-dom/client")
    }
  },
  build: {
    outDir: "dist",
    emptyOutDir: true,
    sourcemap: false,
    rollupOptions: {
      input: {
        popup: resolve(__dirname, "popup.html"),
        sidepanel: resolve(__dirname, "sidepanel.html"),
        options: resolve(__dirname, "options.html"),
        "service-worker": resolve(__dirname, "src/background/service-worker.ts"),
        "content-script": resolve(__dirname, "src/content/content-script.ts")
      },
      output: {
        entryFileNames: "assets/[name].js",
        chunkFileNames: "assets/[name].js",
        assetFileNames: "assets/[name][extname]"
      }
    }
  }
};
