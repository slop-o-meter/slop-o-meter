import { gzipSync } from "node:zlib";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { DateTime } from "luxon";
import rateLimiter from "../rateLimiter.js";
import type WebEnv from "../webEnv.js";

const SAFE_PATH_SEGMENT = /^[a-zA-Z0-9._-]+$/;

function validateSegment(value: string): string {
  const lower = value.toLowerCase();
  if (!SAFE_PATH_SEGMENT.test(lower)) {
    throw new HTTPException(400, { message: "Invalid owner or repo name" });
  }
  return lower;
}

const api = new Hono<WebEnv>();

api.use("/*", async (context, next) => {
  context.header("Cache-Control", "no-store");
  await next();
});

const measureRateLimit = process.env.DATA_BUCKET_NAME
  ? rateLimiter({
      bucketName: process.env.DATA_BUCKET_NAME,
      windowMs: 60_000,
      maxRequests: 3,
    })
  : undefined;

api.post(
  "/measure",
  async (context, next) => {
    if (measureRateLimit) {
      await measureRateLimit(context, next);
    } else {
      await next();
    }
  },
  async (context) => {
    const body = await context.req.json<{
      owner: string;
      repo: string;
    }>();
    const owner = validateSegment(body.owner);
    const repo = validateSegment(body.repo);

    const projectRepository = context.var.projectRepository;
    const project = await projectRepository.getProject(owner, repo);

    if (project?.measurementStatus === "Running") {
      return context.json({ ok: true });
    }

    if (
      project?.lastMeasuredAt &&
      DateTime.fromISO(project.lastMeasuredAt).hasSame(DateTime.utc(), "week")
    ) {
      return context.json({ ok: true });
    }

    await projectRepository.setRunning(owner, repo, "CloningRepo");
    await context.var.measurementQueue.send({ owner, repo });

    return context.json({ ok: true });
  },
);

api.get("/project/:owner/:repo", async (context) => {
  const owner = validateSegment(context.req.param("owner"));
  const repo = validateSegment(context.req.param("repo"));
  const project = await context.var.projectRepository.getProject(owner, repo);
  if (!project) {
    return context.json({ found: false });
  }
  return context.json({ found: true, project });
});

api.get("/project/:owner/:repo/measurement-data", async (context) => {
  const owner = validateSegment(context.req.param("owner"));
  const repo = validateSegment(context.req.param("repo"));
  const data = await context.var.projectRepository.getPreAggregatedData(
    owner,
    repo,
  );
  if (!data) {
    return context.json({ found: false });
  }
  const acceptsGzip = context.req.header("Accept-Encoding")?.includes("gzip");
  context.header("Cache-Control", "public, max-age=3600");
  if (acceptsGzip) {
    const compressed = gzipSync(data);
    return context.body(compressed, 200, {
      "Content-Type": "application/json",
      "Content-Encoding": "gzip",
    });
  }
  return context.body(data, 200, { "Content-Type": "application/json" });
});

export default api;
