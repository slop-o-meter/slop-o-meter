import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import Layout from "../ui/components/Layout/Layout.js";
import HIGHLIGHTED_PROJECTS from "../ui/data/highlightedProjects.js";
import BannerPage from "../ui/pages/BannerPage/BannerPage.js";
import HomePage from "../ui/pages/HomePage/HomePage.js";
import ProjectPage from "../ui/pages/ProjectPage/ProjectPage.js";
import type WebEnv from "../webEnv.js";

const SAFE_PATH_SEGMENT = /^[a-zA-Z0-9._-]+$/;

function validateSegment(value: string): string {
  const lower = value.toLowerCase();
  if (!SAFE_PATH_SEGMENT.test(lower) || lower === "." || lower === "..") {
    throw new HTTPException(400, { message: "Invalid owner or repo name" });
  }
  return lower;
}

const pages = new Hono<WebEnv>();

pages.get("/", async (context) => {
  const highlightedProjects = await context.var.projectRepository.getProjects(
    HIGHLIGHTED_PROJECTS.map((project) => ({
      owner: project.owner,
      repo: project.repo,
    })),
  );

  context.header(
    "Cache-Control",
    "public, max-age=300, stale-while-revalidate=86400",
  );
  return context.html(
    <Layout>
      <HomePage highlightedProjects={highlightedProjects} />
    </Layout>,
  );
});

pages.get("/banner", async (context) => {
  return context.html(
    <Layout>
      <BannerPage />
    </Layout>,
  );
});

pages.get("/:owner/:repo", async (context) => {
  const rawOwner = context.req.param("owner");
  const rawRepo = context.req.param("repo");
  const owner = validateSegment(rawOwner);
  const repo = validateSegment(rawRepo);

  if (rawOwner !== owner || rawRepo !== repo) {
    return context.redirect(`/${owner}/${repo}`, 301);
  }

  const project = await context.var.projectRepository.getProject(owner, repo);

  if (project?.measurement) {
    context.header(
      "Cache-Control",
      "public, max-age=300, stale-while-revalidate=86400",
    );
  } else {
    context.header("Cache-Control", "no-store");
  }
  return context.html(
    <Layout>
      <ProjectPage owner={owner} repo={repo} project={project} />
    </Layout>,
  );
});

export default pages;
