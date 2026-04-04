import { readFile, stat } from "node:fs/promises";
import { join } from "node:path";
import { Hono } from "hono";
import { serveStatic } from "hono/serve-static";
import FilesystemProjectRepository from "../requirement-implementations/FilesystemProjectRepository/FilesystemProjectRepository.js";
import LocalMeasurementQueue from "../requirement-implementations/LocalMeasurementQueue/LocalMeasurementQueue.js";
import S3ProjectRepository from "../requirement-implementations/S3ProjectRepository/S3ProjectRepository.js";
import SqsMeasurementQueue from "../requirement-implementations/SqsMeasurementQueue/SqsMeasurementQueue.js";
import apiRoutes from "./routes/api.js";
import pageRoutes from "./routes/pages.js";
import type WebEnv from "./webEnv.js";

const projectRepository = process.env.DATA_BUCKET_NAME
  ? new S3ProjectRepository(process.env.DATA_BUCKET_NAME)
  : new FilesystemProjectRepository(join(import.meta.dirname, "../../.data"));

const measurementQueue = process.env.MEASUREMENT_QUEUE_URL
  ? new SqsMeasurementQueue(process.env.MEASUREMENT_QUEUE_URL)
  : new LocalMeasurementQueue(projectRepository);

export default new Hono<WebEnv>()
  .use("/*", async (context, next) => {
    context.set("projectRepository", projectRepository);
    context.set("measurementQueue", measurementQueue);
    await next();
  })
  .use(
    "/*",
    serveStatic({
      root: "./public",
      getContent: async (path) => {
        try {
          return await readFile(path);
        } catch {
          return null;
        }
      },
      isDir: async (path) => {
        try {
          return (await stat(path)).isDirectory();
        } catch {
          return false;
        }
      },
      join,
      onFound: (_path, context) => {
        if (context.req.path.startsWith("/static/")) {
          context.header(
            "Cache-Control",
            "public, max-age=31536000, immutable",
          );
        } else {
          context.header(
            "Cache-Control",
            "public, max-age=3600, stale-while-revalidate=86400",
          );
        }
      },
    }),
  )
  .route("/api", apiRoutes)
  .route("/", pageRoutes);
