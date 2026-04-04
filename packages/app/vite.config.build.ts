import { cpSync } from "node:fs";
import { defineConfig } from "vite";

const target = process.env.BUILD_TARGET;

const configs = {
  client: defineConfig({
    build: {
      outDir: "dist/http/public/static",
      emptyOutDir: true,
      copyPublicDir: false,
      rollupOptions: {
        input: {
          "HomePage.client": "src/web/ui/pages/HomePage/HomePage.client.js",
          "ProjectPage.client":
            "src/web/ui/pages/ProjectPage/ProjectPage.client.js",
          "HistoryCharts.client":
            "src/web/ui/components/HistoryCharts/HistoryCharts.client.js",
        },
        output: { entryFileNames: "[name].[hash].js" },
      },
      manifest: true,
    },
    plugins: [
      {
        name: "copy-client-assets",
        closeBundle() {
          cpSync(
            "dist/http/public/static",
            "../infra/assets/web/public/static",
            { recursive: true },
          );
        },
      },
    ],
  }),
  app: defineConfig({
    build: {
      ssr: "src/web/webHandler.ts",
      outDir: "dist/http",
      emptyOutDir: true,
      copyPublicDir: false,
      rollupOptions: {
        output: { entryFileNames: "index.mjs", inlineDynamicImports: true },
      },
      target: "node24",
    },
    ssr: { noExternal: true },
    plugins: [
      {
        name: "copy-assets",
        closeBundle() {
          cpSync("public", "dist/http/public", { recursive: true });
          cpSync("dist/http/index.mjs", "../infra/assets/web/index.mjs");
          cpSync("dist/http/public", "../infra/assets/web/public", {
            recursive: true,
          });
        },
      },
    ],
  }),
  worker: defineConfig({
    build: {
      ssr: "src/worker/workerHandler.ts",
      outDir: "dist/worker",
      emptyOutDir: true,
      copyPublicDir: false,
      rollupOptions: {
        output: { entryFileNames: "index.mjs", inlineDynamicImports: true },
      },
      target: "node24",
    },
    ssr: { noExternal: true },
    plugins: [
      {
        name: "copy-worker-assets",
        closeBundle() {
          cpSync("dist/worker/index.mjs", "../infra/docker/worker/index.mjs");
        },
      },
    ],
  }),
};

const configMap: Record<string, ReturnType<typeof defineConfig>> = {
  client: configs.client,
  worker: configs.worker,
};

export default configMap[target ?? ""] ?? configs.app;
