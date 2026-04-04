import { Hono } from "hono";
import { DateTime } from "luxon";
import type WebEnv from "../webEnv.js";

const api = new Hono<WebEnv>();

api.use("/*", async (context, next) => {
  context.header("Cache-Control", "no-store");
  await next();
});

api.post("/measure", async (context) => {
  const body = await context.req.json<{
    owner: string;
    repo: string;
  }>();
  const owner = body.owner.toLowerCase();
  const repo = body.repo.toLowerCase();

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
});

api.get("/project/:owner/:repo", async (context) => {
  const owner = context.req.param("owner").toLowerCase();
  const repo = context.req.param("repo").toLowerCase();
  const project = await context.var.projectRepository.getProject(owner, repo);
  if (!project) {
    return context.json({ found: false });
  }
  return context.json({ found: true, project });
});

export default api;
