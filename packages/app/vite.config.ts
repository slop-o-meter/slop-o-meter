import devServer from "@hono/vite-dev-server";
import { defineConfig } from "vite";

try {
  process.loadEnvFile();
} catch {
  // No .env file found
}

export default defineConfig({
  plugins: [
    devServer({
      entry: "src/web/web.ts",
    }),
  ],
});
